/**
 * ALEJO Eye Tracking Demo Runner
 * 
 * This script sets up a local server to run the eye tracking demo.
 * It handles dependency checking, server configuration, and provides
 * helpful output for debugging.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import open from 'open';
import chalk from 'chalk';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Configuration
const config = {
  port: 3000,
  demoPath: '/demos/eye-tracking-demo.html',
  requiredFiles: [
    'src/biometrics/eye/tracking.js',
    'src/biometrics/eye/calibration.js',
    'src/biometrics/eye/processor.js',
    'demos/eye-tracking-demo.js',
    'demos/eye-tracking-demo.html'
  ]
};

/**
 * Main function to run the demo
 */
async function runDemo() {
  console.log(chalk.blue.bold('\nALEJO Eye Tracking Demo'));
  console.log(chalk.blue('=======================\n'));
  
  try {
    // Check required files
    checkRequiredFiles();
    
    // Start server
    const server = startServer();
    
    // Open browser
    const url = `http://localhost:${config.port}${config.demoPath}`;
    console.log(chalk.green(`\n✓ Opening demo in browser: ${url}\n`));
    await open(url);
    
    console.log(chalk.yellow('Demo server running. Press Ctrl+C to stop.\n'));
    
    // Display helpful information
    displayHelpfulInfo();
    
    // Handle server shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nShutting down demo server...'));
      server.close(() => {
        console.log(chalk.green('Server stopped.'));
        process.exit(0);
      });
    });
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Check that all required files exist
 */
function checkRequiredFiles() {
  console.log(chalk.yellow('Checking required files...'));
  
  const missingFiles = [];
  
  // Check each required file
  for (const file of config.requiredFiles) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
  }
  
  console.log(chalk.green('✓ All required files present'));
}

/**
 * Start the Express server
 */
function startServer() {
  console.log(chalk.yellow('Starting demo server...'));
  
  const app = express();
  
  // Serve static files from project root
  app.use(express.static(projectRoot));
  
  // Serve node_modules for dependencies
  app.use('/node_modules', express.static(path.join(projectRoot, 'node_modules')));
  
  // Special route for the demo
  app.get('/', (req, res) => {
    res.redirect(config.demoPath);
  });
  
  // Start server
  const server = app.listen(config.port, () => {
    console.log(chalk.green(`✓ Server started on port ${config.port}`));
  });
  
  return server;
}

/**
 * Display helpful information about the demo
 */
function displayHelpfulInfo() {
  console.log(chalk.cyan('HELPFUL INFORMATION:'));
  console.log(chalk.cyan('--------------------'));
  console.log(chalk.white('• The demo requires camera access for face detection'));
  console.log(chalk.white('• Calibration is required for accurate eye tracking'));
  console.log(chalk.white('• Use the accessibility options for different user needs'));
  console.log(chalk.white('• Debug mode shows eye landmarks and gaze direction'));
  console.log(chalk.white('• Privacy modes can blur or mask eye regions'));
  console.log(chalk.white('• Check browser console for detailed event logs'));
  console.log(chalk.white('• For best results, ensure good lighting conditions'));
  console.log(chalk.white('• Performance may vary based on device capabilities\n'));
  
  console.log(chalk.cyan('TROUBLESHOOTING:'));
  console.log(chalk.cyan('---------------'));
  console.log(chalk.white('• If camera access is denied, check browser permissions'));
  console.log(chalk.white('• If face detection fails, try adjusting lighting or position'));
  console.log(chalk.white('• If calibration is difficult, try the "Larger Targets" option'));
  console.log(chalk.white('• If performance is slow, close other applications'));
  console.log(chalk.white('• Check browser console for error messages\n'));
}

// Run the demo
runDemo().catch(error => {
  console.error(chalk.red(`Unhandled error: ${error}`));
  process.exit(1);
});
