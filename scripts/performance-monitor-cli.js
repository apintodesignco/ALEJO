#!/usr/bin/env node

/**
 * ALEJO Performance Monitor CLI
 * 
 * Command-line tool for monitoring ALEJO's performance metrics in real-time.
 * Useful for development, testing, and production monitoring.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const readline = require('readline');

// CLI formatting
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
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

// Configuration
const config = {
  updateInterval: 2000, // ms
  logFile: path.join(__dirname, '../logs/performance-monitor.log'),
  thresholds: {
    cpu: {
      warning: 70, // %
      critical: 90 // %
    },
    memory: {
      warning: 70, // %
      critical: 90 // %
    }
  },
  componentFilter: null,
  showDetails: true
};

// State
let isRunning = false;
let updateTimer = null;
let systemInfo = null;
let performanceData = {
  cpu: [],
  memory: [],
  components: new Map()
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let i = 0;
  
  while (i < args.length) {
    const arg = args[i];
    
    switch (arg) {
      case '--interval':
      case '-i':
        config.updateInterval = parseInt(args[++i], 10) || config.updateInterval;
        break;
      case '--log':
      case '-l':
        config.logFile = args[++i] || config.logFile;
        break;
      case '--component':
      case '-c':
        config.componentFilter = args[++i] || null;
        break;
      case '--no-details':
        config.showDetails = false;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          showHelp();
          process.exit(1);
        }
    }
    
    i++;
  }
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
${colors.bright}ALEJO Performance Monitor CLI${colors.reset}

Usage: node performance-monitor-cli.js [options]

Options:
  --interval, -i <ms>     Update interval in milliseconds (default: 2000)
  --log, -l <path>        Log file path (default: ../logs/performance-monitor.log)
  --component, -c <name>  Filter by component name
  --no-details            Hide detailed component information
  --help, -h              Show this help message

Controls:
  q                       Quit
  c                       Toggle component details
  s                       Save current metrics to log file
  r                       Reset statistics
  h                       Show this help message
  `);
}

/**
 * Initialize the performance monitor
 */
async function initialize() {
  try {
    // Create log directory if it doesn't exist
    const logDir = path.dirname(config.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Get system information
    systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus(),
      totalMemory: os.totalmem(),
      hostname: os.hostname()
    };
    
    console.log(`${colors.bright}ALEJO Performance Monitor${colors.reset}`);
    console.log(`Platform: ${systemInfo.platform} (${systemInfo.arch})`);
    console.log(`CPUs: ${systemInfo.cpus.length} cores`);
    console.log(`Total Memory: ${formatBytes(systemInfo.totalMemory)}`);
    console.log(`Update Interval: ${config.updateInterval}ms`);
    console.log(`Log File: ${config.logFile}`);
    console.log('\nPress \'h\' for help, \'q\' to quit\n');
    
    // Set up keyboard input
    setupKeyboardInput();
    
    // Start monitoring
    isRunning = true;
    startMonitoring();
    
    return true;
  } catch (error) {
    console.error('Failed to initialize performance monitor:', error);
    return false;
  }
}

/**
 * Set up keyboard input handling
 */
function setupKeyboardInput() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      // Ctrl+C
      cleanup();
      process.exit(0);
    } else if (key.name === 'q') {
      // Quit
      cleanup();
      process.exit(0);
    } else if (key.name === 'c') {
      // Toggle component details
      config.showDetails = !config.showDetails;
      console.log(`Component details: ${config.showDetails ? 'shown' : 'hidden'}`);
    } else if (key.name === 's') {
      // Save metrics
      saveMetricsToLog();
    } else if (key.name === 'r') {
      // Reset statistics
      resetStatistics();
    } else if (key.name === 'h') {
      // Show help
      showHelp();
    }
  });
}

/**
 * Start performance monitoring
 */
function startMonitoring() {
  // Clear any existing timer
  if (updateTimer) {
    clearInterval(updateTimer);
  }
  
  // Start update timer
  updateTimer = setInterval(updateMetrics, config.updateInterval);
  
  // Initial update
  updateMetrics();
}

/**
 * Update performance metrics
 */
async function updateMetrics() {
  try {
    // Get system metrics
    const cpuUsage = await getCpuUsage();
    const memoryUsage = getMemoryUsage();
    
    // Update history
    performanceData.cpu.push(cpuUsage);
    performanceData.memory.push(memoryUsage);
    
    // Keep history limited
    if (performanceData.cpu.length > 30) {
      performanceData.cpu.shift();
    }
    if (performanceData.memory.length > 30) {
      performanceData.memory.shift();
    }
    
    // Get component metrics (simulated for CLI)
    updateComponentMetrics();
    
    // Display metrics
    displayMetrics(cpuUsage, memoryUsage);
  } catch (error) {
    console.error('Error updating metrics:', error);
  }
}

/**
 * Get CPU usage percentage
 * @returns {Promise<number>} - CPU usage percentage
 */
async function getCpuUsage() {
  return new Promise((resolve) => {
    const startMeasure = os.cpus().map(cpu => {
      return cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
    });
    const startIdle = os.cpus().map(cpu => cpu.times.idle);
    
    // Wait a bit for next measurement
    setTimeout(() => {
      const endMeasure = os.cpus().map(cpu => {
        return cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
      });
      const endIdle = os.cpus().map(cpu => cpu.times.idle);
      
      // Calculate CPU usage
      const cpuUsages = startMeasure.map((start, i) => {
        const end = endMeasure[i];
        const idleDiff = endIdle[i] - startIdle[i];
        const totalDiff = end - start;
        return 100 - (idleDiff / totalDiff * 100);
      });
      
      // Average CPU usage across cores
      const avgCpuUsage = cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length;
      resolve(avgCpuUsage);
    }, 500);
  });
}

/**
 * Get memory usage percentage
 * @returns {number} - Memory usage percentage
 */
function getMemoryUsage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return (usedMemory / totalMemory) * 100;
}

/**
 * Update component metrics (simulated for CLI)
 */
function updateComponentMetrics() {
  // Simulate component metrics for demonstration
  const components = [
    { id: 'core-system', name: 'Core System', cpu: 5 + Math.random() * 3, memory: 120 + Math.random() * 30 },
    { id: 'gesture-recognition', name: 'Gesture Recognition', cpu: 15 + Math.random() * 10, memory: 80 + Math.random() * 20 },
    { id: 'voice-processing', name: 'Voice Processing', cpu: 10 + Math.random() * 15, memory: 150 + Math.random() * 50 },
    { id: 'ui-rendering', name: 'UI Rendering', cpu: 8 + Math.random() * 7, memory: 60 + Math.random() * 15 },
    { id: 'neural-network', name: 'Neural Network', cpu: 20 + Math.random() * 20, memory: 200 + Math.random() * 100 }
  ];
  
  // Update component data
  components.forEach(component => {
    const existing = performanceData.components.get(component.id);
    
    if (existing) {
      // Update existing component
      existing.cpu.push(component.cpu);
      existing.memory.push(component.memory);
      
      // Keep history limited
      if (existing.cpu.length > 10) {
        existing.cpu.shift();
      }
      if (existing.memory.length > 10) {
        existing.memory.shift();
      }
    } else {
      // Add new component
      performanceData.components.set(component.id, {
        id: component.id,
        name: component.name,
        cpu: [component.cpu],
        memory: [component.memory]
      });
    }
  });
}

/**
 * Display metrics in the console
 * @param {number} cpuUsage - CPU usage percentage
 * @param {number} memoryUsage - Memory usage percentage
 */
function displayMetrics(cpuUsage, memoryUsage) {
  // Clear console
  console.clear();
  
  // Display header
  console.log(`${colors.bright}ALEJO Performance Monitor${colors.reset} (Press 'h' for help, 'q' to quit)`);
  console.log(`Update interval: ${config.updateInterval}ms | Last update: ${new Date().toLocaleTimeString()}`);
  console.log('');
  
  // Display CPU usage
  const cpuColor = cpuUsage >= config.thresholds.cpu.critical ? colors.bgRed :
                  cpuUsage >= config.thresholds.cpu.warning ? colors.red : colors.green;
  
  console.log(`${colors.bright}CPU Usage:${colors.reset} ${cpuColor}${cpuUsage.toFixed(1)}%${colors.reset}`);
  console.log(generateBarGraph(cpuUsage, 50));
  
  // Display memory usage
  const memoryColor = memoryUsage >= config.thresholds.memory.critical ? colors.bgRed :
                     memoryUsage >= config.thresholds.memory.warning ? colors.red : colors.green;
  
  const usedMemory = (systemInfo.totalMemory * (memoryUsage / 100));
  console.log(`${colors.bright}Memory Usage:${colors.reset} ${memoryColor}${memoryUsage.toFixed(1)}%${colors.reset} (${formatBytes(usedMemory)} / ${formatBytes(systemInfo.totalMemory)})`);
  console.log(generateBarGraph(memoryUsage, 50));
  
  // Display component metrics
  if (config.showDetails) {
    console.log(`\n${colors.bright}Component Performance:${colors.reset}`);
    console.log('─'.repeat(80));
    console.log(`${colors.bright}Component${' '.repeat(21)}CPU Usage${' '.repeat(10)}Memory Usage${colors.reset}`);
    console.log('─'.repeat(80));
    
    // Sort components by CPU usage
    const sortedComponents = Array.from(performanceData.components.values())
      .sort((a, b) => {
        const aLastCpu = a.cpu[a.cpu.length - 1];
        const bLastCpu = b.cpu[b.cpu.length - 1];
        return bLastCpu - aLastCpu;
      });
    
    // Filter components if needed
    const componentsToShow = config.componentFilter
      ? sortedComponents.filter(c => c.id.includes(config.componentFilter) || c.name.includes(config.componentFilter))
      : sortedComponents;
    
    // Display each component
    componentsToShow.forEach(component => {
      const lastCpu = component.cpu[component.cpu.length - 1];
      const lastMemory = component.memory[component.memory.length - 1];
      
      const cpuColor = lastCpu >= 50 ? colors.red : lastCpu >= 20 ? colors.yellow : colors.green;
      
      const name = component.name.padEnd(30);
      const cpuStr = `${cpuColor}${lastCpu.toFixed(1)}%${colors.reset}`.padEnd(20);
      const memoryStr = `${formatBytes(lastMemory * 1024 * 1024)}`.padEnd(15);
      
      console.log(`${name}${cpuStr}${memoryStr}`);
    });
  }
  
  // Display history graph if we have enough data
  if (performanceData.cpu.length > 5) {
    console.log(`\n${colors.bright}Performance History (last ${performanceData.cpu.length} samples):${colors.reset}`);
    console.log(generateHistoryGraph(performanceData.cpu, performanceData.memory, 40));
  }
}

/**
 * Generate a bar graph for a percentage value
 * @param {number} percentage - Percentage value
 * @param {number} width - Graph width
 * @returns {string} - Bar graph
 */
function generateBarGraph(percentage, width) {
  const barWidth = Math.round((percentage / 100) * width);
  
  let barColor;
  if (percentage >= config.thresholds.cpu.critical) {
    barColor = colors.bgRed;
  } else if (percentage >= config.thresholds.cpu.warning) {
    barColor = colors.red;
  } else {
    barColor = colors.green;
  }
  
  const bar = barColor + '█'.repeat(barWidth) + colors.reset;
  const emptySpace = '░'.repeat(width - barWidth);
  
  return `[${bar}${emptySpace}]`;
}

/**
 * Generate a history graph for CPU and memory usage
 * @param {number[]} cpuHistory - CPU usage history
 * @param {number[]} memoryHistory - Memory usage history
 * @param {number} height - Graph height
 * @returns {string} - History graph
 */
function generateHistoryGraph(cpuHistory, memoryHistory, height) {
  const width = cpuHistory.length;
  const graph = [];
  
  // Initialize graph with empty spaces
  for (let i = 0; i < height; i++) {
    graph.push(Array(width).fill(' '));
  }
  
  // Plot CPU usage (using 'C')
  for (let i = 0; i < width; i++) {
    const cpuValue = cpuHistory[i];
    const cpuRow = height - Math.round((cpuValue / 100) * height) - 1;
    if (cpuRow >= 0 && cpuRow < height) {
      graph[cpuRow][i] = `${colors.cyan}C${colors.reset}`;
    }
  }
  
  // Plot memory usage (using 'M')
  for (let i = 0; i < width; i++) {
    const memValue = memoryHistory[i];
    const memRow = height - Math.round((memValue / 100) * height) - 1;
    if (memRow >= 0 && memRow < height) {
      // If CPU is already plotted here, use '*' to indicate both
      if (graph[memRow][i] === `${colors.cyan}C${colors.reset}`) {
        graph[memRow][i] = `${colors.magenta}*${colors.reset}`;
      } else {
        graph[memRow][i] = `${colors.magenta}M${colors.reset}`;
      }
    }
  }
  
  // Convert graph to string
  let result = '';
  for (let i = 0; i < height; i++) {
    // Add y-axis labels (100%, 75%, 50%, 25%, 0%)
    const percentage = 100 - Math.round((i / (height - 1)) * 100);
    const label = percentage.toString().padStart(3) + '% ';
    
    result += label + graph[i].join('') + '\n';
  }
  
  // Add x-axis
  result += '     ' + '─'.repeat(width) + '\n';
  
  // Add legend
  result += `     ${colors.cyan}C${colors.reset} = CPU, ${colors.magenta}M${colors.reset} = Memory, ${colors.magenta}*${colors.reset} = Both\n`;
  
  return result;
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes
 * @returns {string} - Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Save current metrics to log file
 */
function saveMetricsToLog() {
  try {
    const timestamp = new Date().toISOString();
    const cpuUsage = performanceData.cpu.length > 0 ? performanceData.cpu[performanceData.cpu.length - 1] : 0;
    const memoryUsage = performanceData.memory.length > 0 ? performanceData.memory[performanceData.memory.length - 1] : 0;
    
    const logEntry = {
      timestamp,
      cpu: cpuUsage,
      memory: memoryUsage,
      components: Array.from(performanceData.components.values()).map(component => ({
        id: component.id,
        name: component.name,
        cpu: component.cpu[component.cpu.length - 1],
        memory: component.memory[component.memory.length - 1]
      }))
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(config.logFile, logLine);
    
    console.log(`\nMetrics saved to ${config.logFile}`);
    
    // Wait for user to press a key to continue
    console.log('Press any key to continue...');
  } catch (error) {
    console.error('Error saving metrics to log:', error);
  }
}

/**
 * Reset performance statistics
 */
function resetStatistics() {
  performanceData.cpu = [];
  performanceData.memory = [];
  performanceData.components.forEach(component => {
    component.cpu = [];
    component.memory = [];
  });
  
  console.log('\nStatistics reset');
  
  // Wait for user to press a key to continue
  console.log('Press any key to continue...');
}

/**
 * Clean up resources
 */
function cleanup() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  
  isRunning = false;
  
  // Reset terminal
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  
  console.log('\nPerformance monitor stopped');
}

// Main function
async function main() {
  parseArgs();
  
  if (await initialize()) {
    // Keep process running
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
  } else {
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = {
  start: initialize,
  stop: cleanup
};
