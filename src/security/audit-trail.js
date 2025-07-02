/**
 * ALEJO Audit Trail System
 * 
 * Secure, tamper-evident logging system for security and personalization events.
 * Features:
 * - Immutable log entries with cryptographic verification
 * - Privacy-focused event filtering
 * - Secure storage with optional encryption
 * - Export and verification capabilities
 */

import { publish, subscribe } from '../core/events.js';
import * as privacyGuard from './privacy-guard.js';

// Constants
const AUDIT_STORE = 'alejo_audit_logs';
const LOG_VERSION = 1;
const MAX_LOCAL_LOGS = 1000; // Maximum number of logs to store locally
const REQUIRED_EVENTS = [
  'user:login',
  'user:logout',
  'privacy:data:stored',
  'privacy:data:accessed',
  'privacy:data:deleted',
  'privacy:storage:cleared',
  'personalization:profile:updated',
  'personalization:voice:trained',
  'personalization:face:trained'
];

// State management
let initialized = false;
let auditDB = null;
let previousLogHash = null;
let isEnabled = true;
let privacyLevel = 'standard'; // 'minimal', 'standard', 'detailed'
let currentUserId = 'anonymous';
let logQueue = [];

/**
 * Initialize the audit trail system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Audit Trail');
  
  if (initialized) {
    console.warn('Audit Trail already initialized');
    return true;
  }
  
  try {
    // Set initial configuration
    isEnabled = options.enabled !== false;
    privacyLevel = options.privacyLevel || 'standard';
    currentUserId = options.userId || 'anonymous';
    
    // Open dedicated audit database
    auditDB = await openAuditDatabase();
    
    // Calculate previous log hash for tamper evidence chain
    previousLogHash = await getLatestLogHash();
    
    // Register for required events
    REQUIRED_EVENTS.forEach(eventName => {
      subscribe(eventName, (data) => logEvent(eventName, data));
    });
    
    // Register for user-specific events
    subscribe('user:login', (data) => {
      if (data?.userId) {
        currentUserId = data.userId;
      }
    });
    
    // Process any queued logs
    if (logQueue.length > 0) {
      await processLogQueue();
    }
    
    initialized = true;
    publish('audit:initialized', { success: true });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Audit Trail:', error);
    publish('audit:error', { 
      type: 'initialization_failed', 
      message: error.message
    });
    return false;
  }
}

/**
 * Open the audit trail database
 * @returns {Promise<IDBDatabase>} IndexedDB database instance
 */
async function openAuditDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIT_STORE, LOG_VERSION);
    
    request.onerror = (event) => {
      reject(new Error(`Audit database error: ${event.target.errorCode}`));
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create logs store with timestamp index
      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', { keyPath: 'id' });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
        logStore.createIndex('userId', 'userId', { unique: false });
        logStore.createIndex('eventType', 'eventType', { unique: false });
      }
    };
  });
}

/**
 * Get the hash of the most recent log entry
 * @returns {Promise<string>} Hash of the latest log or null
 */
async function getLatestLogHash() {
  if (!auditDB) return null;
  
  return new Promise((resolve) => {
    try {
      const transaction = auditDB.transaction(['logs'], 'readonly');
      const store = transaction.objectStore('logs');
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          resolve(cursor.value.hash);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        resolve(null);
      };
    } catch (error) {
      console.error('Error getting latest log hash:', error);
      resolve(null);
    }
  });
}

/**
 * Log an event to the audit trail
 * @param {string} eventType - Type of event
 * @param {Object} eventData - Event data
 * @returns {Promise<boolean>} Success status
 */
export async function logEvent(eventType, eventData = {}) {
  if (!isEnabled) return false;
  
  // Create sanitized event data based on privacy level
  const sanitizedData = sanitizeEventData(eventType, eventData);
  
  // Create the log entry
  const timestamp = Date.now();
  const logEntry = {
    id: `log_${timestamp}_${privacyGuard.generateSecureId(8)}`,
    timestamp,
    eventType,
    userId: currentUserId,
    data: sanitizedData,
    userAgent: navigator.userAgent,
    previousLogHash
  };
  
  // Calculate hash for this entry (includes previousLogHash for tamper evidence)
  logEntry.hash = await calculateLogHash(logEntry);
  
  // Store the log entry
  if (initialized && auditDB) {
    try {
      await storeLogEntry(logEntry);
      previousLogHash = logEntry.hash;
      return true;
    } catch (error) {
      logQueue.push(logEntry);
      console.error('Failed to store audit log:', error);
      return false;
    }
  } else {
    // Queue for later processing
    logQueue.push(logEntry);
    return false;
  }
}

/**
 * Process queued log entries
 * @returns {Promise<boolean>} Success status
 */
async function processLogQueue() {
  if (!initialized || !auditDB) return false;
  
  let success = true;
  
  while (logQueue.length > 0) {
    const logEntry = logQueue.shift();
    try {
      await storeLogEntry(logEntry);
      previousLogHash = logEntry.hash;
    } catch (error) {
      logQueue.unshift(logEntry); // Put it back at the front of the queue
      success = false;
      break;
    }
  }
  
  return success;
}

/**
 * Store a log entry in the database
 * @param {Object} logEntry - The log entry to store
 * @returns {Promise<boolean>} Success status
 */
async function storeLogEntry(logEntry) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = auditDB.transaction(['logs'], 'readwrite');
      const store = transaction.objectStore('logs');
      
      const request = store.add(logEntry);
      
      request.onsuccess = () => {
        // Check if we need to trim logs
        checkAndTrimLogs();
        resolve(true);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Log storage failed: ${event.target.errorCode}`));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check log count and trim if necessary
 */
async function checkAndTrimLogs() {
  try {
    const transaction = auditDB.transaction(['logs'], 'readonly');
    const store = transaction.objectStore('logs');
    const countRequest = store.count();
    
    countRequest.onsuccess = () => {
      const count = countRequest.result;
      if (count > MAX_LOCAL_LOGS) {
        trimOldestLogs(count - MAX_LOCAL_LOGS);
      }
    };
  } catch (error) {
    console.error('Error checking log count:', error);
  }
}

/**
 * Trim oldest logs to keep storage manageable
 * @param {number} countToTrim - Number of logs to trim
 */
async function trimOldestLogs(countToTrim) {
  try {
    // First, export them if possible
    await exportOldestLogsToArchive(countToTrim);
    
    // Then delete them
    const transaction = auditDB.transaction(['logs'], 'readwrite');
    const store = transaction.objectStore('logs');
    const index = store.index('timestamp');
    const request = index.openCursor();
    
    let deletedCount = 0;
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && deletedCount < countToTrim) {
        store.delete(cursor.primaryKey);
        deletedCount++;
        cursor.continue();
      }
    };
  } catch (error) {
    console.error('Error trimming old logs:', error);
  }
}

/**
 * Export oldest logs to archive before trimming
 * @param {number} count - Number of logs to export
 */
async function exportOldestLogsToArchive(count) {
  // In a future implementation, this could:
  // 1. Export logs to encrypted file
  // 2. Upload to user's cloud storage
  // 3. Send to a secure archive service
  
  // For now, we'll just prepare them for export but not actually save
  try {
    const logs = await getOldestLogs(count);
    if (logs.length > 0) {
      console.log(`Prepared ${logs.length} logs for archival`);
      publish('audit:logs:archived', { count: logs.length });
    }
  } catch (error) {
    console.error('Error exporting logs to archive:', error);
  }
}

/**
 * Calculate a hash for a log entry for tamper evidence
 * @param {Object} logEntry - Log entry to hash
 * @returns {Promise<string>} Hash of the log entry
 */
async function calculateLogHash(logEntry) {
  try {
    // Create a string representation of the log without the hash field
    const { hash, ...logWithoutHash } = logEntry;
    const logString = JSON.stringify(logWithoutHash);
    
    // Create a hash using the Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(logString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert the hash to a hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('Error calculating log hash:', error);
    return '';
  }
}

/**
 * Sanitize event data based on privacy level
 * @param {string} eventType - Type of event
 * @param {Object} data - Event data
 * @returns {Object} Sanitized data
 */
function sanitizeEventData(eventType, data) {
  if (!data) return {};
  
  const sanitized = { ...data };
  
  // Apply privacy level filtering
  switch (privacyLevel) {
    case 'minimal':
      // Only record that the event happened, no details
      return {};
      
    case 'standard':
      // Remove sensitive fields but keep general information
      if (sanitized.password) sanitized.password = '[REDACTED]';
      if (sanitized.token) sanitized.token = '[REDACTED]';
      if (sanitized.apiKey) sanitized.apiKey = '[REDACTED]';
      if (sanitized.personalData) sanitized.personalData = '[REDACTED]';
      break;
      
    case 'detailed':
      // Still redact the most sensitive information
      if (sanitized.password) sanitized.password = '[REDACTED]';
      if (sanitized.token) sanitized.token = '[REDACTED]';
      break;
  }
  
  return sanitized;
}

/**
 * Query the audit log for specific events
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Matching log entries
 */
export async function queryLogs(options = {}) {
  if (!initialized || !auditDB) {
    throw new Error('Audit Trail not initialized');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = auditDB.transaction(['logs'], 'readonly');
      const store = transaction.objectStore('logs');
      
      let index = store.index('timestamp');
      let range = null;
      
      // Set up query parameters
      if (options.eventType) {
        index = store.index('eventType');
        range = IDBKeyRange.only(options.eventType);
      } else if (options.userId) {
        index = store.index('userId');
        range = IDBKeyRange.only(options.userId);
      } else if (options.startTime && options.endTime) {
        range = IDBKeyRange.bound(options.startTime, options.endTime);
      } else if (options.startTime) {
        range = IDBKeyRange.lowerBound(options.startTime);
      } else if (options.endTime) {
        range = IDBKeyRange.upperBound(options.endTime);
      }
      
      // Execute query
      const request = index.openCursor(range, options.descending ? 'prev' : 'next');
      const results = [];
      let count = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        const limit = options.limit || Infinity;
        
        if (cursor && count < limit) {
          results.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = (event) => {
        reject(new Error(`Log query failed: ${event.target.errorCode}`));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get the oldest logs from the database
 * @param {number} count - Number of logs to retrieve
 * @returns {Promise<Array>} Oldest log entries
 */
async function getOldestLogs(count) {
  return queryLogs({
    limit: count,
    descending: false
  });
}

/**
 * Export logs for the current user
 * @param {Object} options - Export options
 * @returns {Promise<string>} JSON string of exported logs
 */
export async function exportUserLogs(options = {}) {
  if (!initialized || !auditDB) {
    throw new Error('Audit Trail not initialized');
  }
  
  try {
    // Get logs for current user
    const logs = await queryLogs({
      userId: currentUserId,
      startTime: options.startTime,
      endTime: options.endTime,
      limit: options.limit,
      descending: options.descending
    });
    
    // Create export package
    const exportPackage = {
      exportTime: new Date().toISOString(),
      userId: currentUserId,
      logCount: logs.length,
      logs: logs
    };
    
    // If encryption is requested, encrypt the package
    if (options.encrypted && privacyGuard.isCryptoAvailable()) {
      const encryptedData = await privacyGuard.encryptData(exportPackage);
      return JSON.stringify({
        encrypted: true,
        data: encryptedData
      });
    }
    
    return JSON.stringify(exportPackage);
  } catch (error) {
    console.error('Log export failed:', error);
    throw new Error('Failed to export logs');
  }
}

/**
 * Verify the integrity of the audit log chain
 * @returns {Promise<Object>} Verification results
 */
export async function verifyLogIntegrity() {
  if (!initialized || !auditDB) {
    throw new Error('Audit Trail not initialized');
  }
  
  try {
    const logs = await queryLogs({
      descending: false // Get them in chronological order
    });
    
    if (logs.length === 0) {
      return { valid: true, message: 'No logs to verify' };
    }
    
    let previousHash = null;
    const invalidEntries = [];
    
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      
      // Verify this log's hash
      const calculatedHash = await calculateLogHash({
        ...log,
        hash: undefined
      });
      
      if (calculatedHash !== log.hash) {
        invalidEntries.push({
          index: i,
          id: log.id,
          reason: 'Invalid hash'
        });
        continue;
      }
      
      // Verify chain integrity
      if (i > 0) {
        if (log.previousLogHash !== previousHash) {
          invalidEntries.push({
            index: i,
            id: log.id,
            reason: 'Broken chain'
          });
        }
      }
      
      previousHash = log.hash;
    }
    
    return {
      valid: invalidEntries.length === 0,
      totalLogs: logs.length,
      invalidEntries
    };
  } catch (error) {
    console.error('Log verification failed:', error);
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Set the privacy level for audit logging
 * @param {string} level - Privacy level ('minimal', 'standard', 'detailed')
 */
export function setPrivacyLevel(level) {
  const validLevels = ['minimal', 'standard', 'detailed'];
  if (validLevels.includes(level)) {
    privacyLevel = level;
    logEvent('audit:privacy:updated', { level });
  } else {
    console.error(`Invalid privacy level: ${level}`);
  }
}

/**
 * Enable or disable audit logging
 * @param {boolean} enabled - Whether logging is enabled
 */
export function setEnabled(enabled) {
  isEnabled = !!enabled;
  logEvent('audit:state:updated', { enabled: isEnabled });
}
