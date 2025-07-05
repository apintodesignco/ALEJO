#!/usr/bin/env node

/**
 * ALEJO GitHub Workflow Validator and Fixer
 * 
 * This script validates and fixes common issues in GitHub workflow files:
 * 1. Checks for deprecated action references
 * 2. Validates environment URL references
 * 3. Checks for invalid Netlify args
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const WORKFLOWS_DIR = path.join(PROJECT_ROOT, '.github', 'workflows');

// Known action updates
const ACTION_UPDATES = {
  'netlify/actions/cli@master': 'nwtgck/actions-netlify@v2.0',
  'actions/checkout@v1': 'actions/checkout@v4',
  'actions/checkout@v2': 'actions/checkout@v4',
  'actions/checkout@v3': 'actions/checkout@v4',
  'actions/setup-node@v1': 'actions/setup-node@v4',
  'actions/setup-node@v2': 'actions/setup-node@v4',
  'actions/setup-node@v3': 'actions/setup-node@v4',
  'actions/download-artifact@v1': 'actions/download-artifact@v4',
  'actions/download-artifact@v2': 'actions/download-artifact@v4',
  'actions/download-artifact@v3': 'actions/download-artifact@v4',
  'actions/upload-artifact@v1': 'actions/upload-artifact@v4',
  'actions/upload-artifact@v2': 'actions/upload-artifact@v4',
  'actions/upload-artifact@v3': 'actions/upload-artifact@v4',
  'actions/setup-python@v1': 'actions/setup-python@v5',
  'actions/setup-python@v2': 'actions/setup-python@v5',
  'actions/setup-python@v3': 'actions/setup-python@v5',
  'actions/setup-python@v4': 'actions/setup-python@v5',
};

/**
 * Validates and fixes a GitHub workflow file
 * @param {string} filePath - Path to the workflow file
 * @returns {Object} - Validation results
 */
function validateWorkflow(filePath) {
  console.log(`Validating workflow: ${path.basename(filePath)}`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    fixes: [],
    fixed: false
  };
  
  // Check for deprecated GitHub Actions
  const actionRegex = /uses:\s*([\w-]+\/[\w-]+)@([\w.]+|master)/g;
  let match;
  let fileContent = content;
  let hasChanges = false;
  
  while ((match = actionRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const actionWithVersion = `${match[1]}@${match[2]}`;
    
    // Check if this is a deprecated action that needs updating
    if (ACTION_UPDATES[actionWithVersion]) {
      const newAction = ACTION_UPDATES[actionWithVersion];
      results.warnings.push(`Deprecated action: ${actionWithVersion}, should use ${newAction}`);
      fileContent = fileContent.replace(fullMatch, `uses: ${newAction}`);
      results.fixes.push(`Updated ${actionWithVersion} to ${newAction}`);
      hasChanges = true;
    }
  }
  
  // Check for invalid environment URL references
  const envUrlRegex = /\$\{\{\s*steps\.netlify\.outputs\.deployment-url\s*\}\}/g;
  if (envUrlRegex.test(content)) {
    results.errors.push('Invalid environment URL reference: ${{ steps.netlify.outputs.deployment-url }}, should use ${{ steps.netlify.outputs.deploy-url }}');
    fileContent = fileContent.replace(envUrlRegex, '${{ steps.netlify.outputs.deploy-url }}');
    results.fixes.push('Updated environment URL reference from deployment-url to deploy-url');
    hasChanges = true;
  }
  
  // Check for invalid Netlify args
  const netlifyArgsRegex = /args:\s*\[([^\]]+)\]/g;
  if (netlifyArgsRegex.test(content)) {
    results.warnings.push('Deprecated Netlify args syntax detected, should use publish-dir, production-branch, etc.');
  }
  
  // Check if we need to write changes back to the file
  if (hasChanges) {
    try {
      fs.writeFileSync(filePath, fileContent, 'utf8');
      results.fixed = true;
      console.log(`✓ Fixed workflow file: ${path.basename(filePath)}`);
    } catch (error) {
      results.errors.push(`Failed to write changes to file: ${error.message}`);
      results.fixed = false;
    }
  }
  
  return results;
}

/**
 * Escapes special characters in a string for use in a regular expression
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

/**
 * Main function to validate all workflow files
 */
async function main() {
  try {
    console.log('ALEJO GitHub Workflow Validator and Fixer');
    console.log('=======================================');
    
    // Check if workflows directory exists
    if (!fs.existsSync(WORKFLOWS_DIR)) {
      console.error(`Workflows directory not found: ${WORKFLOWS_DIR}`);
      process.exit(1);
    }
    
    // Get all workflow files
    const files = fs.readdirSync(WORKFLOWS_DIR)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
      .map(file => path.join(WORKFLOWS_DIR, file));
    
    if (files.length === 0) {
      console.log('No workflow files found.');
      process.exit(0);
    }
    
    console.log(`Found ${files.length} workflow file(s).`);
    
    // Validate each workflow file
    let hasErrors = false;
    let hasWarnings = false;
    let hasFixed = false;
    
    for (const file of files) {
      const results = validateWorkflow(file);
      
      if (results.errors.length > 0) {
        console.log(`\n❌ Errors in ${path.basename(file)}:`);
        for (const error of results.errors) {
          console.log(`  - ${error}`);
        }
        hasErrors = true;
      }
      
      if (results.warnings.length > 0) {
        console.log(`\n⚠️ Warnings in ${path.basename(file)}:`);
        for (const warning of results.warnings) {
          console.log(`  - ${warning}`);
        }
        hasWarnings = true;
      }
      
      if (results.fixes.length > 0) {
        console.log(`\n✓ Fixes applied to ${path.basename(file)}:`);
        for (const fix of results.fixes) {
          console.log(`  - ${fix}`);
        }
        hasFixed = true;
      }
      
      if (results.errors.length === 0 && results.warnings.length === 0) {
        console.log(`\n✓ No issues found in ${path.basename(file)}.`);
      }
    }
    
    console.log('\n=== Summary ===');
    if (hasErrors) {
      console.log('❌ Some workflow files have errors that need to be fixed.');
    } else if (hasWarnings) {
      console.log('⚠️ Some workflow files have warnings that should be addressed.');
    } else {
      console.log('✓ All workflow files are valid.');
    }
    
    if (hasFixed) {
      console.log('✓ Some issues were automatically fixed.');
    }
    
    // Return exit code based on errors
    if (hasErrors) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
