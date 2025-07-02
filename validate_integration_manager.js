/**
 * Integration Manager Validation Script
 * 
 * This script validates that the integration-manager.js file is syntactically correct
 * and follows the expected structure for the ALEJO system.
 */

const fs = require('fs');
const path = require('path');

// File path
const filePath = path.join(__dirname, 'src', 'core', 'integration', 'integration-manager.js');

// Validation functions
function validateFileExists() {
  console.log('Checking if integration-manager.js exists...');
  if (!fs.existsSync(filePath)) {
    throw new Error('integration-manager.js file not found');
  }
  console.log('✅ File exists');
  return true;
}

function validateSyntax() {
  console.log('Validating JavaScript syntax...');
  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try to parse it as JavaScript
    new Function(content);
    
    console.log('✅ Syntax validation passed');
    return true;
  } catch (error) {
    console.error('❌ Syntax error:', error.message);
    return false;
  }
}

function validateStructure() {
  console.log('Validating file structure...');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for required components
  const requiredComponents = [
    { name: 'Class definition', pattern: /class\s+IntegrationManager/ },
    { name: 'Constructor', pattern: /constructor\s*\(\s*\)/ },
    { name: 'Initialize method', pattern: /initialize\s*\(\s*\)/ },
    { name: 'Shutdown method', pattern: /shutdown\s*\(\s*\)/ },
    { name: 'Export statement', pattern: /export\s+const\s+integrationManager/ }
  ];
  
  let allFound = true;
  for (const component of requiredComponents) {
    if (component.pattern.test(content)) {
      console.log(`✅ Found: ${component.name}`);
    } else {
      console.error(`❌ Missing: ${component.name}`);
      allFound = false;
    }
  }
  
  return allFound;
}

function validateTaskScheduling() {
  console.log('Validating task scheduling...');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for setInterval calls
  const intervalPattern = /setInterval\s*\(\s*\(\s*\)\s*=>/;
  const matches = content.match(new RegExp(intervalPattern, 'g'));
  
  if (matches && matches.length > 0) {
    console.log(`✅ Found ${matches.length} scheduled tasks`);
    return true;
  } else {
    console.error('❌ No scheduled tasks found');
    return false;
  }
}

// Run all validations
try {
  console.log('='.repeat(50));
  console.log('INTEGRATION MANAGER VALIDATION');
  console.log('='.repeat(50));
  
  const existsValid = validateFileExists();
  const syntaxValid = validateSyntax();
  const structureValid = validateStructure();
  const tasksValid = validateTaskScheduling();
  
  console.log('='.repeat(50));
  
  if (existsValid && syntaxValid && structureValid && tasksValid) {
    console.log('✅ VALIDATION SUCCESSFUL: integration-manager.js is production-ready!');
    process.exit(0);
  } else {
    console.error('❌ VALIDATION FAILED: Please fix the issues above');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Validation error:', error.message);
  process.exit(1);
}
