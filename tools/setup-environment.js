#!/usr/bin/env node

/**
 * ALEJO Environment Setup Script
 * 
 * This script provides a permanent solution for setting up the ALEJO development environment:
 * 1. Verifies Node.js and npm installation
 * 2. Installs required dependencies
 * 3. Fixes module system inconsistencies
 * 4. Validates GitHub workflows
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Configuration
const REQUIRED_NODE_VERSION = '18.0.0'; // Minimum required Node.js version
const REQUIRED_DEPENDENCIES = [
  'yaml',
  'mocha',
  'chai',
  'sinon',
  '@axe-core/puppeteer',
  '@babel/core',
  '@babel/register',
  'axe-html-reporter',
  'express',
  'mocha-html-reporter',
  'mochawesome',
  'puppeteer',
  'yargs'
];

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Main function
 */
async function main() {
  console.log(`${colors.cyan}ALEJO Environment Setup${colors.reset}`);
  console.log(`${colors.cyan}======================${colors.reset}\n`);

  try {
    // Step 1: Verify Node.js and npm
    verifyNodeAndNpm();

    // Step 2: Install required dependencies
    installDependencies();

    // Step 3: Fix module system
    fixModuleSystem();

    // Step 4: Validate GitHub workflows
    validateGitHubWorkflows();

    // Step 5: Provide instructions for permanent PATH fix
    showPathFixInstructions();

    console.log(`\n${colors.green}✓ Environment setup completed successfully!${colors.reset}`);
    console.log(`${colors.green}✓ Your ALEJO development environment is now ready.${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Verify Node.js and npm installation
 */
function verifyNodeAndNpm() {
  console.log(`${colors.blue}Verifying Node.js and npm installation...${colors.reset}`);

  try {
    // Check Node.js version
    const nodeVersion = execSync('node -v').toString().trim().replace('v', '');
    console.log(`${colors.green}✓ Node.js ${nodeVersion} is installed${colors.reset}`);

    // Compare versions
    if (!isVersionGreaterOrEqual(nodeVersion, REQUIRED_NODE_VERSION)) {
      console.warn(`${colors.yellow}⚠ Warning: Node.js ${nodeVersion} is installed, but ALEJO recommends at least ${REQUIRED_NODE_VERSION}${colors.reset}`);
    }

    // Check npm version
    const npmVersion = execSync('npm -v').toString().trim();
    console.log(`${colors.green}✓ npm ${npmVersion} is installed${colors.reset}`);
  } catch (error) {
    throw new Error(`Node.js or npm is not properly installed or not in PATH. Please install Node.js or run the add-nodejs-to-path.ps1 script as Administrator.`);
  }
}

/**
 * Install required dependencies
 */
function installDependencies() {
  console.log(`\n${colors.blue}Checking required dependencies...${colors.reset}`);

  try {
    // Read package.json
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Combine dependencies and devDependencies
    const allDependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };
    
    // Check which dependencies are missing
    const missingDependencies = REQUIRED_DEPENDENCIES.filter(dep => !allDependencies[dep]);
    
    if (missingDependencies.length > 0) {
      console.log(`${colors.yellow}Installing missing dependencies: ${missingDependencies.join(', ')}${colors.reset}`);
      
      // Install missing dependencies
      const installProcess = spawnSync('npm', ['install', '--save-dev', ...missingDependencies], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        shell: true
      });
      
      if (installProcess.status !== 0) {
        throw new Error(`Failed to install dependencies. Exit code: ${installProcess.status}`);
      }
      
      console.log(`${colors.green}✓ All dependencies installed successfully${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ All required dependencies are already installed${colors.reset}`);
    }
    
    // Add test scripts if they don't exist
    let scriptsUpdated = false;
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    const testScripts = {
      "test:accessibility": "node test/run_comprehensive_tests.js --accessibility",
      "test:hearing": "node test/personalization/hearing/run-hearing-accessibility-tests.js",
      "test:vision": "node test/personalization/vision/run-vision-accessibility-tests.js",
      "test:compliance": "node test/accessibility/compliance-tests.js",
      "test:all": "node test/run_comprehensive_tests.js"
    };
    
    for (const [scriptName, scriptCommand] of Object.entries(testScripts)) {
      if (!packageJson.scripts[scriptName]) {
        packageJson.scripts[scriptName] = scriptCommand;
        scriptsUpdated = true;
      }
    }
    
    if (scriptsUpdated) {
      console.log(`${colors.yellow}Adding test scripts to package.json${colors.reset}`);
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log(`${colors.green}✓ Test scripts added to package.json${colors.reset}`);
    }
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${error.message}`);
  }
}

/**
 * Fix module system inconsistencies
 */
function fixModuleSystem() {
  console.log(`\n${colors.blue}Fixing module system inconsistencies...${colors.reset}`);

  try {
    // Run the module system fixer script
    const fixModuleSystemPath = path.join(__dirname, 'fix-module-system.js');
    
    if (fs.existsSync(fixModuleSystemPath)) {
      const fixProcess = spawnSync('node', [fixModuleSystemPath], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        shell: true
      });
      
      if (fixProcess.status !== 0) {
        throw new Error(`Module system fixer failed with exit code: ${fixProcess.status}`);
      }
      
      console.log(`${colors.green}✓ Module system fixed successfully${colors.reset}`);
    } else {
      console.warn(`${colors.yellow}⚠ Module system fixer script not found at ${fixModuleSystemPath}${colors.reset}`);
    }
  } catch (error) {
    throw new Error(`Failed to fix module system: ${error.message}`);
  }
}

/**
 * Validate GitHub workflows
 */
function validateGitHubWorkflows() {
  console.log(`\n${colors.blue}Validating GitHub workflows...${colors.reset}`);

  try {
    // Run the workflow validator script
    const validateWorkflowsPath = path.join(__dirname, 'validate-github-workflows.js');
    
    if (fs.existsSync(validateWorkflowsPath)) {
      const validateProcess = spawnSync('node', [validateWorkflowsPath], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        shell: true
      });
      
      // Note: We don't throw an error if validation fails, as it might just be warnings
      if (validateProcess.status !== 0) {
        console.warn(`${colors.yellow}⚠ GitHub workflow validation completed with issues${colors.reset}`);
      } else {
        console.log(`${colors.green}✓ GitHub workflows validated successfully${colors.reset}`);
      }
    } else {
      console.warn(`${colors.yellow}⚠ GitHub workflow validator script not found at ${validateWorkflowsPath}${colors.reset}`);
    }
  } catch (error) {
    console.warn(`${colors.yellow}⚠ Failed to validate GitHub workflows: ${error.message}${colors.reset}`);
  }
}

/**
 * Show instructions for permanent PATH fix
 */
function showPathFixInstructions() {
  console.log(`\n${colors.blue}Instructions for permanent Node.js PATH fix:${colors.reset}`);
  console.log(`${colors.cyan}1. Right-click on PowerShell and select 'Run as Administrator'${colors.reset}`);
  console.log(`${colors.cyan}2. Navigate to the ALEJO project directory${colors.reset}`);
  console.log(`${colors.cyan}3. Run the following command:${colors.reset}`);
  console.log(`   ${colors.white}./tools/add-nodejs-to-path.ps1${colors.reset}`);
  console.log(`${colors.cyan}4. Restart your terminal or IDE for changes to take effect${colors.reset}`);
}

/**
 * Compare two version strings
 * @param {string} version1 - First version string
 * @param {string} version2 - Second version string
 * @returns {boolean} - True if version1 >= version2
 */
function isVersionGreaterOrEqual(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return true;
    if (v1Part < v2Part) return false;
  }
  
  return true; // Versions are equal
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
  process.exit(1);
});
