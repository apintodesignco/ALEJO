#!/usr/bin/env node

/**
 * ALEJO Environment Fixer
 * 
 * This script provides a comprehensive solution to fix Node.js environment issues:
 * 1. Verifies Node.js installation and PATH
 * 2. Creates temporary batch wrappers if needed
 * 3. Runs the module system fixer to ensure ES module consistency
 * 4. Installs missing dependencies
 * 5. Validates GitHub workflow files
 * 6. Runs tests to verify the environment is working correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Logs a message with color
 * @param {string} message - Message to log
 * @param {string} color - Color to use
 */
function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Logs a section header
 * @param {string} title - Section title
 */
function logSection(title) {
  console.log('\n');
  console.log(`${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}`);
  console.log('');
}

/**
 * Logs a success message
 * @param {string} message - Success message
 */
function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

/**
 * Logs an error message
 * @param {string} message - Error message
 */
function logError(message) {
  log(`✗ ${message}`, colors.red);
}

/**
 * Logs a warning message
 * @param {string} message - Warning message
 */
function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

/**
 * Checks if Node.js is installed and in PATH
 * @returns {Promise<Object>} - Node.js status
 */
async function checkNodeJs() {
  logSection('Checking Node.js Installation');
  
  try {
    // Check if node is in PATH
    const nodeVersion = await execAsync('node --version');
    const npmVersion = await execAsync('npm --version');
    
    logSuccess(`Node.js ${nodeVersion.stdout.trim()} is installed and in PATH`);
    logSuccess(`npm ${npmVersion.stdout.trim()} is installed and in PATH`);
    
    return {
      inPath: true,
      nodeVersion: nodeVersion.stdout.trim(),
      npmVersion: npmVersion.stdout.trim()
    };
  } catch (error) {
    logWarning('Node.js or npm is not in PATH, checking for installation...');
    
    // Check common installation paths
    const commonPaths = [
      'C:\\Program Files\\nodejs',
      'C:\\Program Files (x86)\\nodejs',
      process.env.APPDATA + '\\npm'
    ];
    
    for (const nodePath of commonPaths) {
      if (fs.existsSync(path.join(nodePath, 'node.exe'))) {
        logSuccess(`Found Node.js installation at ${nodePath}`);
        
        // Try to get version using full path
        try {
          const nodeVersion = await execAsync(`"${path.join(nodePath, 'node.exe')}" --version`);
          const npmPath = path.join(nodePath, 'npm.cmd');
          const npmVersion = fs.existsSync(npmPath) 
            ? (await execAsync(`"${npmPath}" --version`)).stdout.trim()
            : 'unknown';
          
          logSuccess(`Node.js ${nodeVersion.stdout.trim()} is installed`);
          logSuccess(`npm ${npmVersion} is installed`);
          
          return {
            inPath: false,
            nodePath,
            nodeVersion: nodeVersion.stdout.trim(),
            npmVersion
          };
        } catch (versionError) {
          logError(`Found Node.js at ${nodePath} but couldn't get version: ${versionError.message}`);
        }
      }
    }
    
    logError('Node.js installation not found in common locations');
    return { inPath: false, found: false };
  }
}

/**
 * Creates batch wrapper scripts for Node.js commands
 * @param {string} nodePath - Path to Node.js installation
 * @returns {Promise<void>}
 */
async function createBatchWrappers(nodePath) {
  logSection('Creating Batch Wrappers');
  
  const wrapperDir = path.join(PROJECT_ROOT, 'tools', 'wrappers');
  
  // Create wrapper directory if it doesn't exist
  if (!fs.existsSync(wrapperDir)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
    logSuccess(`Created wrapper directory: ${wrapperDir}`);
  }
  
  // Create node.bat
  const nodeBat = path.join(wrapperDir, 'node.bat');
  fs.writeFileSync(nodeBat, `@echo off\r\n"${path.join(nodePath, 'node.exe')}" %*`);
  logSuccess(`Created ${nodeBat}`);
  
  // Create npm.bat
  const npmBat = path.join(wrapperDir, 'npm.bat');
  fs.writeFileSync(npmBat, `@echo off\r\n"${path.join(nodePath, 'npm.cmd')}" %*`);
  logSuccess(`Created ${npmBat}`);
  
  // Create npx.bat
  const npxBat = path.join(wrapperDir, 'npx.bat');
  fs.writeFileSync(npxBat, `@echo off\r\n"${path.join(nodePath, 'npx.cmd')}" %*`);
  logSuccess(`Created ${npxBat}`);
  
  // Add wrappers to PATH for this process
  process.env.PATH = `${wrapperDir};${process.env.PATH}`;
  logSuccess(`Added wrappers to PATH for this process`);
}

/**
 * Runs the module system fixer
 * @returns {Promise<void>}
 */
async function runModuleSystemFixer() {
  logSection('Running Module System Fixer');
  
  const fixerPath = path.join(PROJECT_ROOT, 'tools', 'fix-module-system.js');
  
  if (!fs.existsSync(fixerPath)) {
    logError(`Module system fixer not found at ${fixerPath}`);
    return;
  }
  
  try {
    const { stdout, stderr } = await execAsync(`node "${fixerPath}"`);
    console.log(stdout);
    
    if (stderr) {
      console.error(stderr);
    }
    
    logSuccess('Module system fixer completed');
  } catch (error) {
    logError(`Error running module system fixer: ${error.message}`);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
  }
}

/**
 * Validates GitHub workflow files
 * @returns {Promise<void>}
 */
async function validateGitHubWorkflows() {
  logSection('Validating GitHub Workflows');
  
  const validatorPath = path.join(PROJECT_ROOT, 'tools', 'validate-github-workflows.js');
  
  if (!fs.existsSync(validatorPath)) {
    logError(`GitHub workflow validator not found at ${validatorPath}`);
    return;
  }
  
  try {
    const { stdout, stderr } = await execAsync(`node "${validatorPath}"`);
    console.log(stdout);
    
    if (stderr) {
      console.error(stderr);
    }
    
    logSuccess('GitHub workflow validation completed');
  } catch (error) {
    logError(`Error validating GitHub workflows: ${error.message}`);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
  }
}

/**
 * Installs missing dependencies
 * @returns {Promise<void>}
 */
async function installDependencies() {
  logSection('Installing Dependencies');
  
  try {
    log('Installing development dependencies...', colors.cyan);
    await execAsync('npm install --save-dev mocha chai sinon js-yaml');
    logSuccess('Installed development dependencies');
    
    log('Checking for other missing dependencies...', colors.cyan);
    await execAsync('npm install');
    logSuccess('All dependencies installed');
  } catch (error) {
    logError(`Error installing dependencies: ${error.message}`);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
  }
}

/**
 * Runs tests to verify the environment
 * @returns {Promise<void>}
 */
async function runTests() {
  logSection('Running Tests');
  
  try {
    log('Running biometrics tests...', colors.cyan);
    const testProcess = spawn('node', ['tests/run_biometrics_tests.js'], {
      stdio: 'inherit',
      shell: true
    });
    
    return new Promise((resolve, reject) => {
      testProcess.on('close', (code) => {
        if (code === 0) {
          logSuccess('Tests completed successfully');
          resolve();
        } else {
          logError(`Tests failed with exit code ${code}`);
          resolve(); // Don't reject, we want to continue with the script
        }
      });
      
      testProcess.on('error', (error) => {
        logError(`Error running tests: ${error.message}`);
        resolve(); // Don't reject, we want to continue with the script
      });
    });
  } catch (error) {
    logError(`Error running tests: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  log('ALEJO Environment Fixer', colors.bright + colors.magenta);
  log('=====================', colors.bright + colors.magenta);
  
  try {
    // Check Node.js installation
    const nodeStatus = await checkNodeJs();
    
    // Create batch wrappers if Node.js is not in PATH
    if (!nodeStatus.inPath && nodeStatus.nodePath) {
      await createBatchWrappers(nodeStatus.nodePath);
    }
    
    // Run module system fixer
    await runModuleSystemFixer();
    
    // Validate GitHub workflows
    await validateGitHubWorkflows();
    
    // Install dependencies
    await installDependencies();
    
    // Run tests
    await runTests();
    
    logSection('Summary');
    
    if (!nodeStatus.inPath) {
      logWarning('Node.js is not in PATH. To permanently fix this:');
      log('1. Run the PowerShell script as Administrator:', colors.cyan);
      log(`   powershell -ExecutionPolicy Bypass -File "${path.join(PROJECT_ROOT, 'tools', 'add-nodejs-to-path.ps1')}"`, colors.white);
      log('2. Restart your terminal/IDE after running the script', colors.cyan);
    } else {
      logSuccess('Node.js environment is properly configured');
    }
    
    logSuccess('Environment setup completed');
    log('You can now continue with ALEJO development', colors.cyan);
  } catch (error) {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
