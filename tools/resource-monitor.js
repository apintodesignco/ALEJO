#!/usr/bin/env node
/**
 * ALEJO Resource Monitor
 * 
 * Monitors resource usage during build and runtime to prevent system overload.
 * Particularly useful to prevent overheating during resource-intensive operations.
 */

import { cpus, freemem, totalmem } from 'os';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module context
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// ANSI color codes for terminal output
const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Default resource thresholds
const DEFAULT_THRESHOLDS = {
  cpu: {
    warning: 80,   // 80% CPU usage
    critical: 90   // 90% CPU usage
  },
  memory: {
    warning: 80,   // 80% memory usage
    critical: 90   // 90% memory usage
  },
  disk: {
    warning: 80,   // 80% disk usage
    critical: 90   // 90% disk usage
  }
};

// Global state for resource monitoring
const state = {
  isRunning: false,
  intervalId: null,
  measurements: [],
  startTime: null,
  thresholds: DEFAULT_THRESHOLDS,
  listeners: [],
  warnings: [],
  config: {
    sampleIntervalMs: 2000,  // Check every 2 seconds
    logToConsole: true,      // Log to console by default
    logToFile: false,        // Don't log to file by default
    logFilePath: join(projectRoot, 'resource-usage.log'),
    maxSamples: 100,         // Keep last 100 samples in memory
    notifyOnThreshold: true  // Notify when thresholds are exceeded
  }
};

/**
 * Get current CPU usage as a percentage
 * @returns {Promise<number>} - CPU usage percentage (0-100)
 */
async function getCpuUsage() {
  return new Promise((resolve) => {
    const startMeasure = cpus().map(cpu => {
      return {
        idle: cpu.times.idle,
        total: Object.values(cpu.times).reduce((acc, val) => acc + val, 0)
      };
    });
    
    // Wait a short time to measure diff
    setTimeout(() => {
      const endMeasure = cpus().map(cpu => {
        return {
          idle: cpu.times.idle,
          total: Object.values(cpu.times).reduce((acc, val) => acc + val, 0)
        };
      });
      
      // Calculate CPU usage across all cores
      const cpuUsage = startMeasure.map((start, i) => {
        const end = endMeasure[i];
        const idleDiff = end.idle - start.idle;
        const totalDiff = end.total - start.total;
        const usagePercent = 100 - Math.floor(100 * idleDiff / totalDiff);
        return usagePercent;
      });
      
      // Average CPU usage across all cores
      const avgCpuUsage = cpuUsage.reduce((acc, val) => acc + val, 0) / cpuUsage.length;
      resolve(avgCpuUsage);
    }, 500); // Measure over 500ms
  });
}

/**
 * Get current memory usage as a percentage
 * @returns {number} - Memory usage percentage (0-100)
 */
function getMemoryUsage() {
  const free = freemem();
  const total = totalmem();
  return Math.floor((total - free) / total * 100);
}

/**
 * Get current disk usage as a percentage
 * For Windows, Linux, and macOS
 * @returns {Promise<number>} - Disk usage percentage (0-100)
 */
async function getDiskUsage() {
  try {
    // Different approach based on OS
    if (process.platform === 'win32') {
      // Windows - use wmic
      const { exec } = await import('child_process');
      return new Promise((resolve, reject) => {
        exec('wmic logicaldisk get size,freespace,caption', (error, stdout) => {
          if (error) {
            // Fallback to a default value if command fails
            resolve(50); 
            return;
          }
          
          const lines = stdout.trim().split('\n');
          // Skip the header line
          const disks = lines.slice(1).map(line => {
            const parts = line.trim().split(/\s+/);
            // Only process lines with enough data
            if (parts.length >= 3) {
              const caption = parts[0];
              // Find the numeric values (skip any non-numeric parts)
              const numericParts = parts.filter(part => /^\d+$/.test(part));
              if (numericParts.length >= 2) {
                const freeSpace = parseInt(numericParts[0], 10);
                const size = parseInt(numericParts[1], 10);
                return { caption, freeSpace, size };
              }
            }
            return null;
          }).filter(Boolean);
          
          if (disks.length === 0) {
            resolve(50); // Fallback
            return;
          }
          
          // Calculate average usage across all disks
          const totalUsage = disks.reduce((acc, disk) => {
            const used = disk.size - disk.freeSpace;
            const usagePercent = (used / disk.size) * 100;
            return acc + usagePercent;
          }, 0);
          
          resolve(Math.floor(totalUsage / disks.length));
        });
      });
    } else {
      // Linux and macOS - use df
      const { exec } = await import('child_process');
      return new Promise((resolve, reject) => {
        exec('df -k /', (error, stdout) => {
          if (error) {
            // Fallback to a default value if command fails
            resolve(50);
            return;
          }
          
          const lines = stdout.trim().split('\n');
          if (lines.length < 2) {
            resolve(50); // Fallback
            return;
          }
          
          const parts = lines[1].trim().split(/\s+/);
          if (parts.length < 5) {
            resolve(50); // Fallback
            return;
          }
          
          // Parse percentage value (remove % sign)
          const percentUsed = parseInt(parts[4].replace('%', ''), 10);
          resolve(percentUsed);
        });
      });
    }
  } catch (error) {
    console.error(`${COLORS.yellow}⚠️ Error getting disk usage:${COLORS.reset}`, error.message);
    return 50; // Fallback to a default value
  }
}

/**
 * Start monitoring resources
 * @param {Object} options - Monitoring options
 */
async function startMonitoring(options = {}) {
  if (state.isRunning) {
    console.log(`${COLORS.yellow}⚠️ Resource monitoring is already running${COLORS.reset}`);
    return;
  }
  
  // Update config with provided options
  state.config = { ...state.config, ...options };
  state.startTime = Date.now();
  state.isRunning = true;
  state.measurements = [];
  
  // Log start of monitoring
  const logMessage = `📊 Starting resource monitoring with ${state.config.sampleIntervalMs}ms interval`;
  log(logMessage);
  
  // Initial measurement
  await takeMeasurement();
  
  // Set up interval for continuous monitoring
  state.intervalId = setInterval(async () => {
    await takeMeasurement();
  }, state.config.sampleIntervalMs);
}

/**
 * Take a measurement of current resource usage
 */
async function takeMeasurement() {
  try {
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const disk = await getDiskUsage();
    
    const timestamp = Date.now();
    const measurement = { timestamp, cpu, memory, disk };
    
    // Add to measurements array, keeping only the most recent ones
    state.measurements.push(measurement);
    if (state.measurements.length > state.config.maxSamples) {
      state.measurements.shift();
    }
    
    // Log the measurement
    if (state.config.logToConsole) {
      logMeasurement(measurement);
    }
    
    // Write to log file if enabled
    if (state.config.logToFile) {
      await appendToLogFile(measurement);
    }
    
    // Check thresholds
    checkThresholds(measurement);
    
    // Notify listeners
    notifyListeners(measurement);
    
    return measurement;
  } catch (error) {
    console.error(`${COLORS.red}❌ Error taking measurement:${COLORS.reset}`, error.message);
  }
}

/**
 * Log a measurement to the console
 * @param {Object} measurement - Resource measurement
 */
function logMeasurement(measurement) {
  const { cpu, memory, disk } = measurement;
  
  // Format time elapsed
  const elapsed = formatElapsedTime(measurement.timestamp - state.startTime);
  
  // Colorize based on thresholds
  const cpuColor = getColorForValue(cpu, state.thresholds.cpu);
  const memoryColor = getColorForValue(memory, state.thresholds.memory);
  const diskColor = getColorForValue(disk, state.thresholds.disk);
  
  console.log(
    `[${elapsed}] Resources: ` +
    `CPU: ${cpuColor}${cpu.toFixed(1)}%${COLORS.reset} | ` +
    `Memory: ${memoryColor}${memory.toFixed(1)}%${COLORS.reset} | ` +
    `Disk: ${diskColor}${disk.toFixed(1)}%${COLORS.reset}`
  );
}

/**
 * Get color code based on threshold
 * @param {number} value - Current value
 * @param {Object} thresholds - Thresholds for this resource
 * @returns {string} - ANSI color code
 */
function getColorForValue(value, thresholds) {
  if (value >= thresholds.critical) {
    return COLORS.red;
  } else if (value >= thresholds.warning) {
    return COLORS.yellow;
  }
  return COLORS.green;
}

/**
 * Format elapsed time as mm:ss
 * @param {number} ms - Milliseconds elapsed
 * @returns {string} - Formatted time string
 */
function formatElapsedTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Append measurement to log file
 * @param {Object} measurement - Resource measurement
 */
async function appendToLogFile(measurement) {
  try {
    const { timestamp, cpu, memory, disk } = measurement;
    const line = `${new Date(timestamp).toISOString()},${cpu.toFixed(1)},${memory.toFixed(1)},${disk.toFixed(1)}\n`;
    
    // Create file with header if it doesn't exist
    try {
      await fs.access(state.config.logFilePath);
    } catch (error) {
      await fs.writeFile(state.config.logFilePath, 'timestamp,cpu,memory,disk\n');
    }
    
    // Append measurement
    await fs.appendFile(state.config.logFilePath, line);
  } catch (error) {
    console.error(`${COLORS.red}❌ Error writing to log file:${COLORS.reset}`, error.message);
  }
}

/**
 * Check if any resource exceeds thresholds
 * @param {Object} measurement - Resource measurement
 */
function checkThresholds(measurement) {
  if (!state.config.notifyOnThreshold) {
    return;
  }
  
  const { cpu, memory, disk } = measurement;
  const warnings = [];
  
  if (cpu >= state.thresholds.cpu.critical) {
    warnings.push(`CPU usage critical: ${cpu.toFixed(1)}%`);
  } else if (cpu >= state.thresholds.cpu.warning) {
    warnings.push(`CPU usage high: ${cpu.toFixed(1)}%`);
  }
  
  if (memory >= state.thresholds.memory.critical) {
    warnings.push(`Memory usage critical: ${memory.toFixed(1)}%`);
  } else if (memory >= state.thresholds.memory.warning) {
    warnings.push(`Memory usage high: ${memory.toFixed(1)}%`);
  }
  
  if (disk >= state.thresholds.disk.critical) {
    warnings.push(`Disk usage critical: ${disk.toFixed(1)}%`);
  } else if (disk >= state.thresholds.disk.warning) {
    warnings.push(`Disk usage high: ${disk.toFixed(1)}%`);
  }
  
  // Store and log warnings
  if (warnings.length > 0) {
    state.warnings.push({ timestamp: measurement.timestamp, warnings });
    
    if (state.config.logToConsole) {
      warnings.forEach(warning => {
        console.warn(`${COLORS.yellow}⚠️ ${warning}${COLORS.reset}`);
      });
    }
  }
}

/**
 * Add a listener for resource measurements
 * @param {Function} callback - Callback function
 */
function addListener(callback) {
  state.listeners.push(callback);
  return () => {
    state.listeners = state.listeners.filter(listener => listener !== callback);
  };
}

/**
 * Notify all listeners with the latest measurement
 * @param {Object} measurement - Resource measurement
 */
function notifyListeners(measurement) {
  state.listeners.forEach(listener => {
    try {
      listener(measurement);
    } catch (error) {
      console.error(`${COLORS.red}❌ Error in listener:${COLORS.reset}`, error.message);
    }
  });
}

/**
 * Stop monitoring resources
 */
function stopMonitoring() {
  if (!state.isRunning) {
    console.log(`${COLORS.yellow}⚠️ Resource monitoring is not running${COLORS.reset}`);
    return;
  }
  
  // Clear interval
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  
  state.isRunning = false;
  
  // Calculate summary statistics
  const summary = calculateSummary();
  
  // Log summary
  log(`📊 Resource monitoring stopped. Summary:`, false);
  logSummary(summary);
  
  return summary;
}

/**
 * Calculate summary statistics from collected measurements
 * @returns {Object} - Summary statistics
 */
function calculateSummary() {
  if (state.measurements.length === 0) {
    return {
      duration: 0,
      cpu: { min: 0, max: 0, avg: 0 },
      memory: { min: 0, max: 0, avg: 0 },
      disk: { min: 0, max: 0, avg: 0 },
      warnings: state.warnings
    };
  }
  
  const cpuValues = state.measurements.map(m => m.cpu);
  const memoryValues = state.measurements.map(m => m.memory);
  const diskValues = state.measurements.map(m => m.disk);
  
  const duration = state.measurements[state.measurements.length - 1].timestamp - state.startTime;
  
  return {
    duration,
    samples: state.measurements.length,
    cpu: {
      min: Math.min(...cpuValues),
      max: Math.max(...cpuValues),
      avg: cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length
    },
    memory: {
      min: Math.min(...memoryValues),
      max: Math.max(...memoryValues),
      avg: memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length
    },
    disk: {
      min: Math.min(...diskValues),
      max: Math.max(...diskValues),
      avg: diskValues.reduce((sum, val) => sum + val, 0) / diskValues.length
    },
    warnings: state.warnings
  };
}

/**
 * Log a message to console and/or file
 * @param {string} message - Message to log
 * @param {boolean} toFile - Whether to also log to file
 */
function log(message, toFile = true) {
  if (state.config.logToConsole) {
    console.log(message);
  }
  
  if (toFile && state.config.logToFile) {
    try {
      fs.appendFile(state.config.logFilePath, `${message}\n`).catch(console.error);
    } catch (error) {
      console.error(`${COLORS.red}❌ Error appending to log file:${COLORS.reset}`, error.message);
    }
  }
}

/**
 * Log summary statistics
 * @param {Object} summary - Summary statistics
 */
function logSummary(summary) {
  const formattedDuration = formatElapsedTime(summary.duration);
  
  console.log(`${COLORS.bold}Duration:${COLORS.reset} ${formattedDuration}`);
  console.log(`${COLORS.bold}Samples:${COLORS.reset} ${summary.samples}`);
  
  console.log(
    `${COLORS.bold}CPU:${COLORS.reset} ` +
    `Min: ${summary.cpu.min.toFixed(1)}%, ` +
    `Max: ${getColorForValue(summary.cpu.max, state.thresholds.cpu)}${summary.cpu.max.toFixed(1)}%${COLORS.reset}, ` +
    `Avg: ${summary.cpu.avg.toFixed(1)}%`
  );
  
  console.log(
    `${COLORS.bold}Memory:${COLORS.reset} ` +
    `Min: ${summary.memory.min.toFixed(1)}%, ` +
    `Max: ${getColorForValue(summary.memory.max, state.thresholds.memory)}${summary.memory.max.toFixed(1)}%${COLORS.reset}, ` +
    `Avg: ${summary.memory.avg.toFixed(1)}%`
  );
  
  console.log(
    `${COLORS.bold}Disk:${COLORS.reset} ` +
    `Min: ${summary.disk.min.toFixed(1)}%, ` +
    `Max: ${getColorForValue(summary.disk.max, state.thresholds.disk)}${summary.disk.max.toFixed(1)}%${COLORS.reset}, ` +
    `Avg: ${summary.disk.avg.toFixed(1)}%`
  );
  
  // Log warnings
  if (summary.warnings.length > 0) {
    console.log(`${COLORS.bold}Warnings:${COLORS.reset} ${summary.warnings.length} threshold violations`);
  } else {
    console.log(`${COLORS.bold}Warnings:${COLORS.reset} None`);
  }
}

/**
 * Get the current resource usage snapshot
 * @returns {Promise<Object>} - Current resource usage
 */
async function getResourceSnapshot() {
  const cpu = await getCpuUsage();
  const memory = getMemoryUsage();
  const disk = await getDiskUsage();
  
  return { timestamp: Date.now(), cpu, memory, disk };
}

/**
 * Check if the system has enough resources to perform an operation
 * @param {Object} requirements - Resource requirements
 * @returns {Promise<Object>} - Result with available flag and message
 */
async function checkResourceAvailability(requirements = { cpu: 20, memory: 50, disk: 10 }) {
  const snapshot = await getResourceSnapshot();
  const result = {
    available: true,
    message: 'Resources available',
    details: {}
  };
  
  // Check CPU availability
  if (snapshot.cpu + requirements.cpu > 100) {
    result.available = false;
    result.details.cpu = {
      available: 100 - snapshot.cpu,
      required: requirements.cpu
    };
  }
  
  // Check memory availability
  if (snapshot.memory + requirements.memory > 100) {
    result.available = false;
    result.details.memory = {
      available: 100 - snapshot.memory,
      required: requirements.memory
    };
  }
  
  // Check disk availability
  if (snapshot.disk + requirements.disk > 100) {
    result.available = false;
    result.details.disk = {
      available: 100 - snapshot.disk,
      required: requirements.disk
    };
  }
  
  // Generate detailed message
  if (!result.available) {
    const details = [];
    
    if (result.details.cpu) {
      details.push(`CPU: ${result.details.cpu.available.toFixed(1)}% available, ${requirements.cpu}% required`);
    }
    
    if (result.details.memory) {
      details.push(`Memory: ${result.details.memory.available.toFixed(1)}% available, ${requirements.memory}% required`);
    }
    
    if (result.details.disk) {
      details.push(`Disk: ${result.details.disk.available.toFixed(1)}% available, ${requirements.disk}% required`);
    }
    
    result.message = `Insufficient resources: ${details.join(', ')}`;
  }
  
  return result;
}

/**
 * Update thresholds for resource monitoring
 * @param {Object} newThresholds - New threshold values
 */
function updateThresholds(newThresholds) {
  state.thresholds = {
    ...state.thresholds,
    ...newThresholds
  };
  
  log(`📊 Updated resource thresholds`);
}

/**
 * Run the resource monitor as a standalone tool
 */
async function runStandalone() {
  console.log(`${COLORS.bold}${COLORS.blue}📊 ALEJO Resource Monitor${COLORS.reset}`);
  console.log(`${COLORS.blue}Monitoring system resources...${COLORS.reset}`);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {};
  
  // Simple argument parsing
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--interval' && i + 1 < args.length) {
      options.sampleIntervalMs = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--log-file' && i + 1 < args.length) {
      options.logToFile = true;
      options.logFilePath = args[i + 1];
      i++;
    } else if (args[i] === '--duration' && i + 1 < args.length) {
      const durationSec = parseInt(args[i + 1], 10);
      i++;
      
      // Start monitoring
      await startMonitoring(options);
      
      // Stop after specified duration
      setTimeout(() => {
        stopMonitoring();
        process.exit(0);
      }, durationSec * 1000);
      
      // Keep process running
      return;
    }
  }
  
  // Default behavior - just show a snapshot
  const snapshot = await getResourceSnapshot();
  
  console.log(`${COLORS.bold}Current Resource Usage:${COLORS.reset}`);
  console.log(`${COLORS.bold}CPU:${COLORS.reset} ${getColorForValue(snapshot.cpu, state.thresholds.cpu)}${snapshot.cpu.toFixed(1)}%${COLORS.reset}`);
  console.log(`${COLORS.bold}Memory:${COLORS.reset} ${getColorForValue(snapshot.memory, state.thresholds.memory)}${snapshot.memory.toFixed(1)}%${COLORS.reset}`);
  console.log(`${COLORS.bold}Disk:${COLORS.reset} ${getColorForValue(snapshot.disk, state.thresholds.disk)}${snapshot.disk.toFixed(1)}%${COLORS.reset}`);
  
  // Check for potential resource issues
  if (
    snapshot.cpu >= state.thresholds.cpu.warning ||
    snapshot.memory >= state.thresholds.memory.warning ||
    snapshot.disk >= state.thresholds.disk.warning
  ) {
    console.log(`\n${COLORS.yellow}⚠️ Resource usage is high. Consider optimizing or closing unused applications.${COLORS.reset}`);
  } else {
    console.log(`\n${COLORS.green}✅ System resources look good.${COLORS.reset}`);
  }
}

// Export API for programmatic use
export {
  startMonitoring,
  stopMonitoring,
  getResourceSnapshot,
  checkResourceAvailability,
  updateThresholds,
  addListener
};

// Run standalone if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone();
}
