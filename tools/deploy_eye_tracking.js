/**
 * ALEJO Eye Tracking Deployment Script
 * 
 * This script automates the deployment of eye tracking modules into the ALEJO system.
 * It verifies dependencies, runs tests, and integrates the eye tracking modules with
 * the main biometrics system.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Configuration
const config = {
  requiredFiles: [
    'src/biometrics/eye/tracking.js',
    'src/biometrics/eye/calibration.js',
    'src/biometrics/eye/processor.js',
    'src/biometrics/index.js'
  ],
  testFiles: [
    'tests/biometrics/eye-modules.test.js',
    'tests/biometrics/eye-tracking-integration.test.js'
  ],
  demoFiles: [
    'demos/eye-tracking-demo.js',
    'demos/eye-tracking-demo.html'
  ],
  dependencies: {
    'face-api.js': '^0.22.2',
    'tensorflow': '^3.0.0',
    'tensorflow-models': '^2.0.0'
  }
};

/**
 * Main deployment function
 */
async function deployEyeTracking() {
  console.log('ALEJO Eye Tracking Deployment');
  console.log('==============================\n');
  
  try {
    // Check required files
    checkRequiredFiles();
    
    // Verify dependencies
    await verifyDependencies();
    
    // Run tests
    await runTests();
    
    // Update version tag
    updateVersionTag();
    
    // Create GitHub release
    createGitHubRelease();
    
    console.log('\n✅ Eye tracking modules successfully deployed!');
    console.log('Run the demo with: npm run demo:eye-tracking');
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

/**
 * Check that all required files exist
 */
function checkRequiredFiles() {
  console.log('Checking required files...');
  
  const missingFiles = [];
  
  // Check each required file
  for (const file of config.requiredFiles) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  // Check test files
  for (const file of config.testFiles) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  // Check demo files
  for (const file of config.demoFiles) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
  }
  
  console.log('✓ All required files present');
}

/**
 * Verify that all dependencies are installed
 */
async function verifyDependencies() {
  console.log('Verifying dependencies...');
  
  try {
    // Read package.json
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const missingDependencies = [];
    
    // Check each required dependency
    for (const [dependency, version] of Object.entries(config.dependencies)) {
      if (!packageJson.dependencies[dependency] && !packageJson.devDependencies[dependency]) {
        missingDependencies.push(`${dependency}@${version}`);
      }
    }
    
    // Install missing dependencies if any
    if (missingDependencies.length > 0) {
      console.log(`Installing missing dependencies: ${missingDependencies.join(', ')}`);
      execSync(`npm install --save ${missingDependencies.join(' ')}`, { stdio: 'inherit' });
    }
    
    console.log('✓ All dependencies verified');
  } catch (error) {
    throw new Error(`Failed to verify dependencies: ${error.message}`);
  }
}

/**
 * Run tests for eye tracking modules
 */
async function runTests() {
  console.log('Running tests...');
  
  try {
    // Run eye tracking module tests
    execSync('npm test -- --testPathPattern=biometrics/eye', { stdio: 'inherit' });
    console.log('✓ All tests passed');
  } catch (error) {
    throw new Error('Tests failed. Please fix failing tests before deploying.');
  }
}

/**
 * Update version tag in version.py
 */
function updateVersionTag() {
  console.log('Updating version tag...');
  
  try {
    // Read version.py
    const versionPath = path.join(projectRoot, 'src', 'version.py');
    let versionContent = fs.readFileSync(versionPath, 'utf8');
    
    // Update version with eye tracking tag
    const today = new Date().toISOString().split('T')[0];
    versionContent = versionContent.replace(
      /RELEASE_NAME = "(.*)"/,
      `RELEASE_NAME = "$1 with Eye Tracking"`
    );
    versionContent = versionContent.replace(
      /BUILD_DATE = "(.*)"/,
      `BUILD_DATE = "${today}"`
    );
    
    // Write updated version
    fs.writeFileSync(versionPath, versionContent);
    
    console.log('✓ Version tag updated');
  } catch (error) {
    console.warn(`Warning: Could not update version tag: ${error.message}`);
    // Non-fatal error, continue deployment
  }
}

/**
 * Create GitHub release
 */
function createGitHubRelease() {
  console.log('Creating GitHub release...');
  
  try {
    // Generate release notes
    const releaseNotes = generateReleaseNotes();
    
    // Write release notes to file
    const releaseNotesPath = path.join(projectRoot, 'RELEASE_NOTES.md');
    fs.writeFileSync(releaseNotesPath, releaseNotes);
    
    // Tag commit with [MAJOR FEATURE] tag
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "[MAJOR FEATURE] Add eye tracking modules to biometrics system"', { stdio: 'inherit' });
    
    console.log('✓ GitHub release prepared');
    console.log('Run the tag_major_update.py script to finalize the release');
  } catch (error) {
    console.warn(`Warning: Could not create GitHub release: ${error.message}`);
    // Non-fatal error, continue deployment
  }
}

/**
 * Generate release notes for eye tracking modules
 */
function generateReleaseNotes() {
  return `# ALEJO Eye Tracking Release Notes

## Overview

This release adds comprehensive eye tracking capabilities to the ALEJO biometrics system. The eye tracking modules provide pupil detection, gaze estimation, blink detection, and saccade detection, all with a focus on privacy, accessibility, and local-first processing.

## New Features

- **Eye Tracking Module**: Core eye tracking functionality including pupil detection, gaze estimation, blink detection, and saccade detection.
- **Eye Calibration Module**: Multi-point calibration procedure with accessibility options.
- **Eye Processor Module**: Video frame processing with privacy filters and debug visualization.
- **Biometrics Integration**: Seamless integration with the existing biometrics system.
- **Demo Application**: Interactive demo showcasing eye tracking capabilities.

## Technical Details

- All processing happens locally on the client device for maximum privacy.
- Adaptive performance management balances responsiveness and resource use.
- Event-driven architecture for loose coupling and extensibility.
- Comprehensive test coverage for all modules.
- Detailed documentation in \`docs/biometrics/eye-tracking.md\`.

## Getting Started

Run the eye tracking demo:

\`\`\`
npm run demo:eye-tracking
\`\`\`

## Known Issues

- Eye tracking requires calibration for optimal accuracy.
- Performance may vary depending on device capabilities.
- Face detection must be enabled for eye tracking to work.

## Future Enhancements

- Advanced gaze prediction for smoother tracking
- Eye-based UI control
- Attention analysis
- Multi-person eye tracking
`;
}

// Run deployment
deployEyeTracking().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
