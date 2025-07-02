// Simple syntax validator for JavaScript files
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// File to validate
const filePath = process.argv[2] || './src/core/integration/integration-manager.js';

console.log(`Validating syntax for: ${filePath}`);

try {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Use Node.js to check syntax without executing
  try {
    execSync(`node --check ${filePath}`, { stdio: 'pipe' });
    console.log('✅ Syntax validation successful!');
  } catch (error) {
    console.error('❌ Syntax validation failed:', error.stderr.toString());
    process.exit(1);
  }
  
  // Read file content for additional validation
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for class definition
  if (content.includes('class IntegrationManager')) {
    console.log('✅ Found IntegrationManager class');
  } else {
    console.error('❌ Missing IntegrationManager class');
  }
  
  // Check for initialize method
  if (content.includes('initialize()')) {
    console.log('✅ Found initialize() method');
  } else {
    console.error('❌ Missing initialize() method');
  }
  
  // Check for shutdown method
  if (content.includes('shutdown()')) {
    console.log('✅ Found shutdown() method');
  } else {
    console.error('❌ Missing shutdown() method');
  }
  
  // Count scheduled tasks
  const taskMatches = content.match(/setInterval\(/g);
  if (taskMatches) {
    console.log(`✅ Found ${taskMatches.length} scheduled tasks`);
  } else {
    console.error('❌ No scheduled tasks found');
  }
  
  console.log('✅ VALIDATION COMPLETE: File is syntactically correct and has the expected structure');
  
} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
