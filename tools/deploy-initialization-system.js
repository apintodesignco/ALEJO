/**
 * ALEJO Initialization System Deployment Script
 * 
 * This script automates the deployment of the ALEJO initialization system,
 * including verification of all required components, running tests,
 * and preparing the system for production use.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Configuration
const config = {
  // Core system paths
  corePath: path.resolve(__dirname, '../src/core/system'),
  testPath: path.resolve(__dirname, '../tests/core/system'),
  
  // Required core files
  requiredFiles: [
    'initialization-manager.js',
    'fallback-manager.js',
    'progressive-loading-manager.js',
    'initialization-log-viewer.js',
    'monitoring-dashboard.js',
    'error-handler.js'
  ],
  
  // Required test files
  requiredTests: [
    'initialization-manager.test.js',
    'fallback-manager.test.js',
    'progressive-loading-manager.test.js',
    'initialization-log-viewer.test.js',
    'progressive-loading-integration.test.js'
  ],
  
  // Build output path
  buildPath: path.resolve(__dirname, '../dist/core/system'),
  
  // Deployment targets
  deploymentTargets: {
    development: path.resolve(__dirname, '../dev-server/core/system'),
    staging: path.resolve(__dirname, '../staging/core/system'),
    production: path.resolve(__dirname, '../production/core/system')
  }
};

/**
 * Main deployment function
 */
async function deployInitializationSystem(target = 'development') {
  console.log(chalk.blue('='.repeat(80)));
  console.log(chalk.blue.bold(`ALEJO Initialization System Deployment - ${target.toUpperCase()}`));
  console.log(chalk.blue('='.repeat(80)));
  
  try {
    // Verify all required files exist
    verifyRequiredFiles();
    
    // Run tests
    runTests();
    
    // Build the system
    buildSystem();
    
    // Deploy to target environment
    deployToTarget(target);
    
    // Generate documentation
    generateDocumentation();
    
    console.log(chalk.green.bold('\n✓ Deployment completed successfully!'));
    console.log(chalk.green(`The initialization system has been deployed to ${target}.`));
    
  } catch (error) {
    console.error(chalk.red.bold('\n✗ Deployment failed!'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Verify all required files exist
 */
function verifyRequiredFiles() {
  console.log(chalk.cyan('\n📋 Verifying required files...'));
  
  // Check core files
  const missingCoreFiles = config.requiredFiles.filter(file => {
    const filePath = path.join(config.corePath, file);
    return !fs.existsSync(filePath);
  });
  
  if (missingCoreFiles.length > 0) {
    throw new Error(`Missing core files: ${missingCoreFiles.join(', ')}`);
  }
  
  // Check test files
  const missingTestFiles = config.requiredTests.filter(file => {
    const filePath = path.join(config.testPath, file);
    return !fs.existsSync(filePath);
  });
  
  if (missingTestFiles.length > 0) {
    throw new Error(`Missing test files: ${missingTestFiles.join(', ')}`);
  }
  
  console.log(chalk.green('✓ All required files are present.'));
}

/**
 * Run tests for the initialization system
 */
function runTests() {
  console.log(chalk.cyan('\n🧪 Running tests...'));
  
  try {
    // Run Jest tests for the initialization system
    execSync('npx jest tests/core/system --coverage', { stdio: 'inherit' });
    console.log(chalk.green('✓ All tests passed.'));
  } catch (error) {
    throw new Error('Tests failed. Please fix the failing tests before deploying.');
  }
}

/**
 * Build the initialization system
 */
function buildSystem() {
  console.log(chalk.cyan('\n🔨 Building the system...'));
  
  try {
    // Create build directory if it doesn't exist
    if (!fs.existsSync(config.buildPath)) {
      fs.mkdirSync(config.buildPath, { recursive: true });
    }
    
    // Copy core files to build directory
    config.requiredFiles.forEach(file => {
      const sourcePath = path.join(config.corePath, file);
      const destPath = path.join(config.buildPath, file);
      
      fs.copyFileSync(sourcePath, destPath);
    });
    
    // Create a version file
    const versionInfo = {
      version: process.env.npm_package_version || '1.0.0',
      buildDate: new Date().toISOString(),
      buildEnvironment: process.env.NODE_ENV || 'development'
    };
    
    fs.writeFileSync(
      path.join(config.buildPath, 'version.json'),
      JSON.stringify(versionInfo, null, 2)
    );
    
    console.log(chalk.green('✓ Build completed.'));
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }
}

/**
 * Deploy to target environment
 */
function deployToTarget(target) {
  console.log(chalk.cyan(`\n🚀 Deploying to ${target}...`));
  
  const targetPath = config.deploymentTargets[target];
  
  if (!targetPath) {
    throw new Error(`Invalid deployment target: ${target}`);
  }
  
  try {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    
    // Copy build files to target directory
    fs.readdirSync(config.buildPath).forEach(file => {
      const sourcePath = path.join(config.buildPath, file);
      const destPath = path.join(targetPath, file);
      
      fs.copyFileSync(sourcePath, destPath);
    });
    
    // Create deployment info file
    const deploymentInfo = {
      deploymentDate: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown',
      target
    };
    
    fs.writeFileSync(
      path.join(targetPath, 'deployment-info.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(chalk.green(`✓ Deployed to ${target}.`));
  } catch (error) {
    throw new Error(`Deployment failed: ${error.message}`);
  }
}

/**
 * Generate documentation
 */
function generateDocumentation() {
  console.log(chalk.cyan('\n📚 Generating documentation...'));
  
  const docsPath = path.resolve(__dirname, '../docs/core/system');
  
  // Create docs directory if it doesn't exist
  if (!fs.existsSync(docsPath)) {
    fs.mkdirSync(docsPath, { recursive: true });
  }
  
  try {
    // Generate documentation using JSDoc
    execSync('npx jsdoc -c jsdoc.config.json src/core/system -d docs/core/system', { stdio: 'inherit' });
    
    // Generate a README for the initialization system
    const readmePath = path.join(docsPath, 'README.md');
    const readmeContent = generateReadmeContent();
    
    fs.writeFileSync(readmePath, readmeContent);
    
    console.log(chalk.green('✓ Documentation generated.'));
  } catch (error) {
    console.warn(chalk.yellow(`⚠ Documentation generation failed: ${error.message}`));
    console.warn(chalk.yellow('Continuing with deployment...'));
  }
}

/**
 * Generate README content
 */
function generateReadmeContent() {
  return `# ALEJO Initialization System

## Overview

The ALEJO Initialization System provides a robust framework for initializing components in a controlled, prioritized manner with support for fallbacks, progressive loading, and detailed monitoring.

## Core Components

### Initialization Manager

Handles the registration and initialization of system components, respecting dependencies and priorities.

**Key Features:**
- Component registration and dependency management
- Prioritized initialization sequence
- Error handling and retry logic
- Event publishing for initialization lifecycle events

### Fallback Manager

Provides fallback implementations when primary component initialization fails.

**Key Features:**
- Fallback registration and execution
- Retry logic with configurable attempts
- Accessibility-preserving fallbacks
- Fallback usage statistics

### Progressive Loading Manager

Manages the loading sequence of components based on priority, accessibility, and resource constraints.

**Key Features:**
- Phase-based loading strategy
- Accessibility prioritization
- Resource-aware loading decisions
- Deferred component loading

### Initialization Log Viewer

Provides detailed logging and visualization of the initialization process.

**Key Features:**
- Comprehensive event logging
- Filtered log retrieval
- Timeline visualization
- High contrast mode support

### Monitoring Dashboard

Provides a user interface for monitoring the initialization process.

**Key Features:**
- Real-time initialization status
- Component dependency visualization
- Fallback usage statistics
- Progressive loading sequence visualization

## Usage

\`\`\`javascript
// Register a component
registerComponent({
  id: 'my.component',
  initialize: async () => {
    // Initialization logic
    return true;
  },
  priority: 100,
  dependencies: ['core.dependency'],
  isAccessibility: true,
  isEssential: true
});

// Initialize the system
await initializeSystem();

// Open the monitoring dashboard
openMonitoringDashboard();
\`\`\`

## Testing

Run the tests with:

\`\`\`bash
npm test -- tests/core/system
\`\`\`

## Deployment

Deploy the system with:

\`\`\`bash
node tools/deploy-initialization-system.js [target]
\`\`\`

Where \`target\` is one of: development, staging, production.
`;
}

// Parse command line arguments
const target = process.argv[2] || 'development';

// Run the deployment
deployInitializationSystem(target)
  .catch(error => {
    console.error(chalk.red(`Deployment failed: ${error.message}`));
    process.exit(1);
  });
