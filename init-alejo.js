#!/usr/bin/env node
/**
 * ALEJO Initialization Script
 * 
 * One-click startup system for ALEJO that:
 * 1. Verifies environment requirements
 * 2. Loads or creates configuration
 * 3. Starts all essential services
 * 4. Opens the interface in a browser
 * 5. Sets up monitoring and diagnostics
 * 
 * Usage: node init-alejo.js [--port=9000] [--no-browser] [--local-only]
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { startMonitoring, stopMonitoring, getResourceSnapshot, checkResourceAvailability } from './tools/resource-monitor.js';
import { getSelfDiagnostics } from './src/system/self-diagnostics.js';
import { getRecoverySystem } from './src/core/recovery-system.js';

// Get directory name for ES modules
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    acc[key] = value !== undefined ? value : true;
  }
  return acc;
}, {});

// Default configuration
const defaultConfig = {
  port: args.port || 9000,
  resourceLimits: {
    maxCpuPercent: 75,
    maxMemoryMb: 1024,
    maxDiskUsageMb: 500
  },
  accessibility: true,
  autoStart: !args['no-browser'],
  localOnly: args['local-only'] !== false,
  security: {
    encryptLocalStorage: true,
    cspEnabled: true,
    allowedOrigins: ['self']
  },
  performance: {
    enableProgressiveLoading: true,
    cacheAssets: true,
    enableServiceWorker: true,
    preloadCriticalAssets: true
  }
};

// Create config directory if it doesn't exist
const configDir = join(__dirname, 'config');
if (!existsSync(configDir)) {
  mkdirSync(configDir, { recursive: true });
}

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

/**
 * Log message to console and file
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warn, error)
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  console[level](logMessage);
  
  // Also write to log file
  const logFile = join(logsDir, `alejo-${new Date().toISOString().split('T')[0]}.log`);
  try {
    const logEntry = logMessage + '\n';
    // Append to log file
    const fs = require('fs');
    fs.appendFileSync(logFile, logEntry);
  } catch (e) {
    console.error(`Failed to write to log file: ${e.message}`);
  }
}

/**
 * Initialize ALEJO
 */
async function initializeAlejo() {
  log('ALEJO: Starting initialization process...');
  
  // Step 1: Check environment
  log('Checking environment...');
  if (process.version.startsWith('v16') || process.version.startsWith('v17')) {
    log('Warning: ALEJO is optimized for Node.js v18+. Some features may not work correctly.', 'warn');
  } else if (!process.version.startsWith('v18') && !process.version.startsWith('v19') && !process.version.startsWith('v20')) {
    log(`Unsupported Node.js version: ${process.version}. Please use Node.js v18 or later.`, 'error');
    process.exit(1);
  }
  
  // Step 2: Load or create configuration
  log('Loading configuration...');
  const configPath = join(configDir, 'alejo.config.json');
  let config = defaultConfig;
  
  if (existsSync(configPath)) {
    try {
      const configFile = readFileSync(configPath, 'utf8');
      const loadedConfig = JSON.parse(configFile);
      config = { ...defaultConfig, ...loadedConfig };
      log('Loaded configuration from alejo.config.json');
    } catch (error) {
      log(`Error loading configuration: ${error.message}. Using defaults.`, 'warn');
    }
  } else {
    try {
      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      log('Created default configuration file');
    } catch (error) {
      log(`Error creating configuration file: ${error.message}`, 'warn');
    }
  }
  
  // Apply command line overrides
  if (args.port) config.port = parseInt(args.port);
  if (args['no-browser'] !== undefined) config.autoStart = !args['no-browser'];
  if (args['local-only'] !== undefined) config.localOnly = args['local-only'];
  
  // Step 3: Initialize recovery system
  log('Initializing recovery system...');
  const recoverySystem = getRecoverySystem();
  recoverySystem.configure({
    maxAttempts: 3,
    backupFrequencyMs: 60000,
    automaticRecovery: true
  });
  
  // Step 4: Initialize self-diagnostics
  log('Initializing self-diagnostics...');
  const diagnostics = getSelfDiagnostics();
  diagnostics.setAutoRepair(true);
  
  // Step 5: Start the server
  log(`Starting ALEJO server on port ${config.port}...`);
  const distDir = join(__dirname, 'dist');
  
  // Check if we have a compiled build
  if (existsSync(distDir) && existsSync(join(distDir, 'index.html'))) {
    log('Using production build...');
    startProductionServer(distDir, config);
  } else {
    log('Production build not found, starting development server...');
    startDevelopmentServer(config);
  }
}

/**
 * Start the production server
 * @param {string} distDir - Distribution directory
 * @param {Object} config - Server configuration
 */
function startProductionServer(distDir, config) {
  // Create a simple static file server
  const server = createServer((req, res) => {
    try {
      // Get the request path, default to index.html for root
      let url = req.url;
      if (url === '/') url = '/index.html';
      
      // Prevent directory traversal attacks
      if (url.includes('..')) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      // Construct the file path
      const filePath = join(distDir, url);
      
      // Check if file exists
      if (!existsSync(filePath)) {
        // Try serving index.html for SPA routing
        if (existsSync(join(distDir, 'index.html'))) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(readFileSync(join(distDir, 'index.html')));
          return;
        }
        
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      
      // Read the file
      const content = readFileSync(filePath);
      
      // Set appropriate content type
      const ext = url.split('.').pop().toLowerCase();
      const contentTypeMap = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'eot': 'application/vnd.ms-fontobject',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav'
      };
      
      // Set security headers
      const headers = {
        'Content-Type': contentTypeMap[ext] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      };
      
      // Add CSP if enabled
      if (config.security.cspEnabled) {
        headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'";
      }
      
      res.writeHead(200, headers);
      res.end(content);
    } catch (error) {
      log(`Server error: ${error.message}`, 'error');
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });
  
  // Check resource availability before starting
  checkResourceAvailability({
    cpu: 20,    // Require at least 20% CPU available
    memory: 30, // Require at least 30% memory available
    disk: 10    // Require at least 10% disk space available
  }).then(resourceCheck => {
    if (!resourceCheck.available) {
      log(`Warning: ${resourceCheck.message}`, 'warn');
      log('ALEJO will still attempt to start, but performance may be affected.', 'warn');
    }
    
    // Start the server
    const host = config.localOnly ? 'localhost' : '0.0.0.0';
    server.listen(config.port, host, () => {
      const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${config.port}`;
      log(`✅ ALEJO is running! Access at ${url}`);
      
      // Start resource monitoring
      startMonitoring({
        sampleIntervalMs: 5000,  // Check every 5 seconds
        logToConsole: false,     // Don't log to console for production
        notifyOnThreshold: true, // Show warnings for high resource usage
        maxSamples: 50           // Keep last 50 samples
      });
      
      // Add listener for critical resource usage
      const removeListener = addListener(measurement => {
        // Check if CPU or memory is critically high
        if (measurement.cpu > 90 || measurement.memory > 90) {
          log(`Critical resource usage detected: CPU ${measurement.cpu.toFixed(1)}%, Memory ${measurement.memory.toFixed(1)}%`, 'error');
          log('Consider closing other applications or increasing resource limits in alejo.config.json', 'warn');
        }
      });
      
      // Auto-open browser if configured
      if (config.autoStart) {
        openBrowser(url);
      }
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${config.port} is already in use. Try a different port.`, 'error');
      } else {
        log(`Server error: ${error.message}`, 'error');
      }
      stopMonitoring(); // Stop resource monitoring on error
      process.exit(1);
    });
    
    // Setup termination handlers
    setupTerminationHandlers(server);
  }).catch(error => {
    log(`Resource check failed: ${error.message}`, 'error');
    // Continue starting the server anyway
    server.listen(config.port, config.localOnly ? 'localhost' : '0.0.0.0');
  });
}

/**
 * Start the development server using Vite
 * @param {Object} config - Server configuration
 */
function startDevelopmentServer(config) {
  try {
    // Check if vite is installed
    execSync('npx vite --version', { stdio: 'ignore' });
    
    log('Starting Vite development server...');
    const viteProcess = spawn('npx', ['vite', '--port', config.port], {
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    viteProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log(`Vite: ${output}`);
        
        // Check if server has started and extract URL
        if (output.includes('Local:') && config.autoStart) {
          const urlMatch = output.match(/Local:\s+(http:\/\/[^/]+)/);
          if (urlMatch && urlMatch[1]) {
            openBrowser(urlMatch[1]);
          }
        }
      }
    });
    
    viteProcess.stderr.on('data', (data) => {
      log(`Vite Error: ${data.toString().trim()}`, 'error');
    });
    
    viteProcess.on('close', (code) => {
      if (code !== 0) {
        log(`Vite process exited with code ${code}`, 'error');
        process.exit(code);
      }
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      log('Shutting down ALEJO development server...');
      viteProcess.kill();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      log('Shutting down ALEJO development server...');
      viteProcess.kill();
      process.exit(0);
    });
  } catch (error) {
    log('Failed to start Vite development server. Falling back to production server build...', 'warn');
    log('Building production version...');
    
    try {
      execSync('npm run build', { stdio: 'inherit' });
      log('Build complete, starting production server...');
      startProductionServer(join(__dirname, 'dist'), config);
    } catch (buildError) {
      log(`Failed to build: ${buildError.message}`, 'error');
      process.exit(1);
    }
  }
}

/**
 * Set up handlers for process termination signals
 * @param {http.Server} server - HTTP server to close on termination
 */
function setupTerminationHandlers(server) {
  // Handle normal exit
  process.on('exit', () => {
    log('ALEJO is shutting down...', 'info');
    // Note: stopMonitoring() can't be used in 'exit' event as it's asynchronous
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    log('Received SIGINT (Ctrl+C). ALEJO is gracefully shutting down...', 'info');
    // Stop the resource monitoring and log the final summary
    const summary = stopMonitoring();
    if (summary) {
      log(`Resource usage during this session - CPU avg: ${summary.cpu.avg.toFixed(1)}%, Memory avg: ${summary.memory.avg.toFixed(1)}%`, 'info');
    }
    
    server.close(() => {
      log('Server closed. Goodbye!', 'info');
      process.exit(0);
    });
  });
  
  // Handle kill signal
  process.on('SIGTERM', () => {
    log('Received SIGTERM. ALEJO is gracefully shutting down...', 'info');
    // Stop the resource monitoring and log the final summary
    stopMonitoring();
    
    server.close(() => {
      log('Server closed. Goodbye!', 'info');
      process.exit(0);
    });
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`, 'error');
    console.error(error);
    // Stop resource monitoring on crash
    stopMonitoring();
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled promise rejection: ${reason}`, 'error');
    console.error('Unhandled promise rejection:', reason);
    // Stop resource monitoring on crash
    stopMonitoring();
  });
}

/**
 * Open the browser to the specified URL
 * @param {string} url - URL to open
 */
function openBrowser(url) {
  setTimeout(() => {
    log(`Opening browser at ${url}`);
    
    try {
      const command = process.platform === 'win32' ? 
        `start "" "${url}"` : 
        process.platform === 'darwin' ? 
          `open "${url}"` : 
          `xdg-open "${url}"`;
      
      execSync(command);
    } catch (error) {
      log(`Failed to open browser: ${error.message}`, 'warn');
      log(`Please open ${url} manually in your browser.`);
    }
  }, 1000);
}

// Start ALEJO
initializeAlejo().catch(error => {
  log(`Initialization error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
