/**
 * @file log-manager.js
 * @description Production-grade logging system with log rotation, retention policies, and different log levels
 * @module utils/log-manager
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

/**
 * Log levels in order of severity
 * @enum {number}
 */
export const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
  NONE: 6 // Used to disable logging
};

/**
 * Maps log level names to their string representations
 * @type {Object}
 */
const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.TRACE]: 'TRACE',
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.FATAL]: 'FATAL'
};

/**
 * Maps log levels to colors for console output
 * @type {Object}
 */
const LOG_LEVEL_COLORS = {
  [LOG_LEVELS.TRACE]: '#888888', // Gray
  [LOG_LEVELS.DEBUG]: '#0066cc', // Blue
  [LOG_LEVELS.INFO]: '#009900',  // Green
  [LOG_LEVELS.WARN]: '#ff9900',  // Orange
  [LOG_LEVELS.ERROR]: '#cc0000', // Red
  [LOG_LEVELS.FATAL]: '#990000'  // Dark Red
};

/**
 * Default log rotation settings
 * @type {Object}
 */
const DEFAULT_ROTATION_CONFIG = {
  maxSize: 5 * 1024 * 1024,     // 5 MB max file size
  maxFiles: 10,                 // Keep 10 log files
  compress: true,               // Compress rotated logs
  interval: '1d',               // Rotate daily
  retentionDays: 30             // Keep logs for 30 days
};

/**
 * LogManager class
 * Manages logging with rotation and retention policies
 */
export class LogManager {
  /**
   * Create a LogManager instance
   * @param {Object} options - Logger configuration
   * @param {string} options.name - Logger name
   * @param {number} options.level - Minimum log level to record
   * @param {string} options.logDirectory - Directory to store log files
   * @param {boolean} options.console - Whether to log to console
   * @param {boolean} options.file - Whether to log to file
   * @param {Object} options.rotation - Log rotation settings
   */
  constructor(options = {}) {
    this.name = options.name || 'alejo';
    this.level = options.level !== undefined ? options.level : LOG_LEVELS.INFO;
    this.logToConsole = options.console !== false;
    this.logToFile = options.file !== false;
    this.logDirectory = options.logDirectory || './logs';
    this.rotationConfig = {
      ...DEFAULT_ROTATION_CONFIG,
      ...(options.rotation || {})
    };
    
    this.logs = [];
    this.maxLogMemory = options.maxLogMemory || 1000; // Maximum number of logs to keep in memory
    this.activeLogFile = null;
    this.fileSize = 0;
    this.rotationScheduled = false;
    this.isNodeEnvironment = typeof process !== 'undefined' && typeof process.versions !== 'undefined';
    
    // Set up log directory if in Node environment
    if (this.isNodeEnvironment && this.logToFile) {
      this._setupLogDirectory();
      this._setupRotation();
    }
    
    // Override console methods if specified
    if (options.overrideConsole) {
      this._overrideConsole();
    }
  }

  /**
   * Set up log directory
   * @private
   */
  _setupLogDirectory() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
      
      const currentDate = new Date().toISOString().split('T')[0];
      this.activeLogFile = path.join(this.logDirectory, `${this.name}-${currentDate}.log`);
      
      // Check if file exists and get size
      if (fs.existsSync(this.activeLogFile)) {
        const stats = fs.statSync(this.activeLogFile);
        this.fileSize = stats.size;
      }
    } catch (error) {
      console.error(`Failed to set up log directory: ${error.message}`);
      this.logToFile = false; // Disable file logging
    }
  }

  /**
   * Set up log rotation schedule
   * @private
   */
  _setupRotation() {
    if (this.rotationScheduled) return;
    
    // Setup daily rotation at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeToMidnight = tomorrow.getTime() - now.getTime();
    
    // Schedule rotation
    setTimeout(() => {
      this._rotateLog();
      
      // Setup next rotation
      setInterval(() => {
        this._rotateLog();
      }, 24 * 60 * 60 * 1000); // Every 24 hours
      
      this.rotationScheduled = true;
    }, timeToMidnight);
  }

  /**
   * Rotate log file
   * @private
   */
  _rotateLog() {
    if (!this.isNodeEnvironment || !this.logToFile) return;
    
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Create new log file with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const newLogFile = path.join(this.logDirectory, `${this.name}-${currentDate}.log`);
      
      // If previous log file exists and has different name, compress it
      if (this.activeLogFile && this.activeLogFile !== newLogFile && fs.existsSync(this.activeLogFile) && this.rotationConfig.compress) {
        this._compressLogFile(this.activeLogFile);
      }
      
      // Update active log file
      this.activeLogFile = newLogFile;
      this.fileSize = 0;
      
      // Clean up old logs
      this._cleanupOldLogs();
    } catch (error) {
      console.error(`Failed to rotate log: ${error.message}`);
    }
  }

  /**
   * Compress a log file
   * @param {string} filePath - Path to log file
   * @private
   */
  _compressLogFile(filePath) {
    try {
      const fs = require('fs');
      const zlib = require('zlib');
      
      const content = fs.readFileSync(filePath);
      const compressed = zlib.gzipSync(content);
      fs.writeFileSync(`${filePath}.gz`, compressed);
      fs.unlinkSync(filePath); // Remove original file
    } catch (error) {
      console.error(`Failed to compress log file: ${error.message}`);
    }
  }

  /**
   * Clean up old log files
   * @private
   */
  _cleanupOldLogs() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Get all log files
      const files = fs.readdirSync(this.logDirectory)
        .filter(file => file.startsWith(`${this.name}-`) && (file.endsWith('.log') || file.endsWith('.log.gz')))
        .sort((a, b) => {
          const aMatch = a.match(new RegExp(`${this.name}-(\\d{4}-\\d{2}-\\d{2})`));
          const bMatch = b.match(new RegExp(`${this.name}-(\\d{4}-\\d{2}-\\d{2})`));
          
          if (aMatch && bMatch) {
            return new Date(bMatch[1]) - new Date(aMatch[1]); // Descending order by date
          }
          return 0;
        });
      
      // If we have more files than maxFiles, delete oldest
      if (files.length > this.rotationConfig.maxFiles) {
        const filesToDelete = files.slice(this.rotationConfig.maxFiles);
        filesToDelete.forEach(file => {
          fs.unlinkSync(path.join(this.logDirectory, file));
        });
      }
      
      // Delete files older than retention days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.rotationConfig.retentionDays);
      
      files.forEach(file => {
        const match = file.match(new RegExp(`${this.name}-(\\d{4}-\\d{2}-\\d{2})`));
        if (match) {
          const fileDate = new Date(match[1]);
          if (fileDate < cutoffDate) {
            fs.unlinkSync(path.join(this.logDirectory, file));
          }
        }
      });
    } catch (error) {
      console.error(`Failed to clean up old logs: ${error.message}`);
    }
  }

  /**
   * Override console methods
   * @private
   */
  _overrideConsole() {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
      trace: console.trace
    };
    
    console.log = (...args) => {
      this.info(...args);
      return originalConsole.log(...args);
    };
    
    console.info = (...args) => {
      this.info(...args);
      return originalConsole.info(...args);
    };
    
    console.warn = (...args) => {
      this.warn(...args);
      return originalConsole.warn(...args);
    };
    
    console.error = (...args) => {
      this.error(...args);
      return originalConsole.error(...args);
    };
    
    console.debug = (...args) => {
      this.debug(...args);
      return originalConsole.debug(...args);
    };
    
    console.trace = (...args) => {
      this.trace(...args);
      return originalConsole.trace(...args);
    };
  }

  /**
   * Format a log message
   * @param {number} level - Log level
   * @param {Array} args - Log arguments
   * @returns {Object} Formatted log entry
   * @private
   */
  _formatLogEntry(level, args) {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level] || 'UNKNOWN';
    
    // Format message
    let message = '';
    
    for (const arg of args) {
      if (typeof arg === 'string') {
        message += arg;
      } else if (arg instanceof Error) {
        message += `${arg.message}\n${arg.stack}`;
      } else {
        try {
          message += JSON.stringify(arg);
        } catch (error) {
          message += `[Unstringifiable Object: ${typeof arg}]`;
        }
      }
      
      message += ' ';
    }
    
    return {
      timestamp,
      level,
      levelName,
      message: message.trim(),
      context: this.name
    };
  }

  /**
   * Write log to file
   * @param {Object} logEntry - Log entry
   * @private
   */
  _writeToFile(logEntry) {
    if (!this.isNodeEnvironment || !this.logToFile || !this.activeLogFile) return;
    
    try {
      const fs = require('fs');
      const logLine = `[${logEntry.timestamp}] [${logEntry.levelName}] ${logEntry.context}: ${logEntry.message}\n`;
      
      // Append to file
      fs.appendFileSync(this.activeLogFile, logLine);
      
      // Update file size
      this.fileSize += Buffer.byteLength(logLine);
      
      // Rotate if file size exceeds max size
      if (this.fileSize > this.rotationConfig.maxSize) {
        this._rotateLog();
      }
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  /**
   * Print log to console
   * @param {Object} logEntry - Log entry
   * @private
   */
  _printToConsole(logEntry) {
    if (!this.logToConsole) return;
    
    const color = LOG_LEVEL_COLORS[logEntry.level] || '#000000';
    const prefix = `%c[${logEntry.timestamp}] [${logEntry.levelName}] ${logEntry.context}:`;
    const style = `color: ${color}; font-weight: bold;`;
    
    // Use appropriate console method based on level
    switch (logEntry.level) {
      case LOG_LEVELS.TRACE:
      case LOG_LEVELS.DEBUG:
        console.debug(prefix, style, logEntry.message);
        break;
      case LOG_LEVELS.INFO:
        console.info(prefix, style, logEntry.message);
        break;
      case LOG_LEVELS.WARN:
        console.warn(prefix, style, logEntry.message);
        break;
      case LOG_LEVELS.ERROR:
      case LOG_LEVELS.FATAL:
        console.error(prefix, style, logEntry.message);
        break;
    }
  }

  /**
   * Add log to in-memory store
   * @param {Object} logEntry - Log entry
   * @private
   */
  _addToMemory(logEntry) {
    this.logs.push(logEntry);
    
    // Trim logs if exceeding max memory
    if (this.logs.length > this.maxLogMemory) {
      this.logs = this.logs.slice(-this.maxLogMemory);
    }
  }

  /**
   * Log a message at the specified level
   * @param {number} level - Log level
   * @param {...any} args - Log arguments
   * @private
   */
  _log(level, ...args) {
    // Skip if level is lower than minimum
    if (level < this.level) return;
    
    // Format log entry
    const logEntry = this._formatLogEntry(level, args);
    
    // Add to in-memory logs
    this._addToMemory(logEntry);
    
    // Write to file
    this._writeToFile(logEntry);
    
    // Print to console
    this._printToConsole(logEntry);
    
    return logEntry;
  }

  /**
   * Get logs filtered by level and time range
   * @param {Object} options - Filter options
   * @param {number} options.level - Minimum log level
   * @param {Date} options.startDate - Start date
   * @param {Date} options.endDate - End date
   * @returns {Array} Filtered logs
   */
  getLogs(options = {}) {
    const level = options.level !== undefined ? options.level : this.level;
    const startDate = options.startDate || new Date(0);
    const endDate = options.endDate || new Date();
    
    return this.logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return log.level >= level && logDate >= startDate && logDate <= endDate;
    });
  }

  /**
   * Clear all in-memory logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Set the minimum log level
   * @param {number} level - New log level
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * Log trace message
   * @param {...any} args - Log arguments
   */
  trace(...args) {
    return this._log(LOG_LEVELS.TRACE, ...args);
  }

  /**
   * Log debug message
   * @param {...any} args - Log arguments
   */
  debug(...args) {
    return this._log(LOG_LEVELS.DEBUG, ...args);
  }

  /**
   * Log info message
   * @param {...any} args - Log arguments
   */
  info(...args) {
    return this._log(LOG_LEVELS.INFO, ...args);
  }

  /**
   * Log warning message
   * @param {...any} args - Log arguments
   */
  warn(...args) {
    return this._log(LOG_LEVELS.WARN, ...args);
  }

  /**
   * Log error message
   * @param {...any} args - Log arguments
   */
  error(...args) {
    return this._log(LOG_LEVELS.ERROR, ...args);
  }

  /**
   * Log fatal error message
   * @param {...any} args - Log arguments
   */
  fatal(...args) {
    return this._log(LOG_LEVELS.FATAL, ...args);
  }
}

// Create singleton instance
let logManager = null;

/**
 * Get the LogManager instance
 * @param {Object} options - Logger configuration
 * @returns {LogManager} LogManager instance
 */
export function getLogManager(options = {}) {
  if (!logManager) {
    logManager = new LogManager(options);
  } else if (Object.keys(options).length > 0) {
    // Update existing instance with new options
    Object.assign(logManager, options);
  }
  
  return logManager;
}
