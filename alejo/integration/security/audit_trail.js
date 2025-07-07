/**
 * ALEJO Audit Trail
 * 
 * This module tracks all security-relevant operations for transparency,
 * compliance, and debugging purposes. It provides a comprehensive audit
 * trail of user interactions, system operations, and security events.
 * 
 * @module alejo/integration/security/audit_trail
 */

import EventEmitter from 'events';

// Audit event types
const AUDIT_EVENT_TYPES = {
  SECURITY: 'security',           // Security-related events
  PRIVACY: 'privacy',             // Privacy-related events
  CONSENT: 'consent',             // Consent-related events
  ACCESS: 'access',               // Access control events
  DATA: 'data',                   // Data handling events
  USER: 'user',                   // User interaction events
  SYSTEM: 'system',               // System operation events
  ERROR: 'error'                  // Error events
};

// Audit event severity levels
const AUDIT_SEVERITY = {
  INFO: 'info',                   // Informational events
  WARNING: 'warning',             // Warning events
  ERROR: 'error',                 // Error events
  CRITICAL: 'critical'            // Critical events
};

/**
 * AuditTrail class that manages the audit trail
 */
class AuditTrail extends EventEmitter {
  /**
   * Create a new AuditTrail instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.enabled - Whether audit trail is enabled
   * @param {number} options.retentionLimit - Maximum number of audit entries to retain
   * @param {boolean} options.persistToStorage - Whether to persist audit trail to storage
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      enabled: true,
      retentionLimit: 10000,
      persistToStorage: true,
      logToConsole: false,
      anonymizePersonalData: true,
      ...options
    };
    
    // Initialize audit trail storage
    this.auditTrail = [];
    
    // Initialize event listeners
    this._initEventListeners();
    
    // Log initialization event
    this.logEvent('system', {
      action: 'audit_trail_initialized',
      severity: AUDIT_SEVERITY.INFO
    });
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Listen for configuration changes
    this.on('config:update', (newConfig) => {
      this.updateConfiguration(newConfig);
    });
    
    // Listen for storage events
    if (this.options.persistToStorage) {
      this.on('audit:persist', () => {
        this._persistToStorage();
      });
    }
  }
  
  /**
   * Log an event to the audit trail
   * @param {string} eventType - Type of event (from AUDIT_EVENT_TYPES)
   * @param {Object} eventData - Event data
   * @param {string} eventData.action - Action performed
   * @param {string} eventData.severity - Severity level (from AUDIT_SEVERITY)
   * @returns {string} - ID of the audit entry
   */
  logEvent(eventType, eventData = {}) {
    if (!this.options.enabled) {
      return null;
    }
    
    // Validate event type
    if (!AUDIT_EVENT_TYPES[eventType.toUpperCase()]) {
      console.error(`Invalid audit event type: ${eventType}`);
      eventType = AUDIT_EVENT_TYPES.ERROR;
    }
    
    // Set default severity if not provided
    if (!eventData.severity) {
      eventData.severity = AUDIT_SEVERITY.INFO;
    }
    
    // Generate audit entry
    const timestamp = new Date().toISOString();
    const entryId = this._generateEntryId(timestamp);
    
    // Process event data to remove sensitive information if needed
    const processedData = this.options.anonymizePersonalData ? 
      this._anonymizePersonalData(eventData) : eventData;
    
    const auditEntry = {
      id: entryId,
      timestamp,
      type: eventType,
      data: processedData
    };
    
    // Add to audit trail
    this.auditTrail.push(auditEntry);
    
    // Enforce retention limit
    if (this.auditTrail.length > this.options.retentionLimit) {
      this.auditTrail.shift();
    }
    
    // Log to console if enabled
    if (this.options.logToConsole) {
      console.log(`AUDIT [${eventType}] ${timestamp}:`, processedData);
    }
    
    // Emit audit event
    this.emit('audit:entry', auditEntry);
    
    // Persist to storage if enabled
    if (this.options.persistToStorage) {
      this.emit('audit:persist');
    }
    
    return entryId;
  }
  
  /**
   * Generate a unique ID for an audit entry
   * @private
   * @param {string} timestamp - Timestamp of the entry
   * @returns {string} - Unique ID
   */
  _generateEntryId(timestamp) {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `audit-${timestamp.replace(/[^0-9]/g, '')}-${random}`;
  }
  
  /**
   * Anonymize personal data in event data
   * @private
   * @param {Object} eventData - Event data
   * @returns {Object} - Anonymized event data
   */
  _anonymizePersonalData(eventData) {
    // Create a deep copy to avoid modifying the original
    const anonymized = JSON.parse(JSON.stringify(eventData));
    
    // Define patterns for personal data
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
      ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
    };
    
    // Function to recursively process object properties
    const processObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }
      
      Object.entries(obj).forEach(([key, value]) => {
        // Skip certain keys that should never be anonymized
        if (['id', 'timestamp', 'type', 'severity', 'action'].includes(key)) {
          return;
        }
        
        // Check for sensitive key names
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential', 'auth'];
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          obj[key] = '[REDACTED]';
          return;
        }
        
        // Process based on value type
        if (typeof value === 'string') {
          // Check for patterns in string values
          let redacted = value;
          Object.entries(patterns).forEach(([patternName, pattern]) => {
            redacted = redacted.replace(pattern, `[REDACTED_${patternName.toUpperCase()}]`);
          });
          
          obj[key] = redacted;
        } else if (typeof value === 'object' && value !== null) {
          // Recursively process nested objects
          processObject(value);
        }
      });
      
      return obj;
    };
    
    return processObject(anonymized);
  }
  
  /**
   * Persist audit trail to storage
   * @private
   */
  _persistToStorage() {
    // In a real implementation, this would save to a database or file
    // For this example, we'll just simulate persistence
    try {
      // Simulate storage operation
      const storageOperation = new Promise((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, 10);
      });
      
      storageOperation.then(() => {
        this.emit('audit:persisted', {
          count: this.auditTrail.length,
          timestamp: new Date().toISOString()
        });
      });
    } catch (error) {
      console.error('Error persisting audit trail:', error);
      this.emit('audit:persist:error', error);
    }
  }
  
  /**
   * Get audit entries
   * @param {Object} filters - Filters to apply
   * @param {string} filters.type - Filter by event type
   * @param {string} filters.severity - Filter by severity
   * @param {string} filters.fromDate - Filter by start date (ISO string)
   * @param {string} filters.toDate - Filter by end date (ISO string)
   * @param {number} limit - Maximum number of entries to return
   * @param {number} offset - Offset for pagination
   * @returns {Array} - Filtered audit entries
   */
  getAuditEntries(filters = {}, limit = 100, offset = 0) {
    if (!this.options.enabled) {
      return [];
    }
    
    let filteredEntries = [...this.auditTrail];
    
    // Apply type filter
    if (filters.type) {
      filteredEntries = filteredEntries.filter(entry => entry.type === filters.type);
    }
    
    // Apply severity filter
    if (filters.severity) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.data && entry.data.severity === filters.severity);
    }
    
    // Apply date range filters
    if (filters.fromDate) {
      const fromDate = new Date(filters.fromDate).getTime();
      filteredEntries = filteredEntries.filter(entry => 
        new Date(entry.timestamp).getTime() >= fromDate);
    }
    
    if (filters.toDate) {
      const toDate = new Date(filters.toDate).getTime();
      filteredEntries = filteredEntries.filter(entry => 
        new Date(entry.timestamp).getTime() <= toDate);
    }
    
    // Apply action filter
    if (filters.action) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.data && entry.data.action === filters.action);
    }
    
    // Sort by timestamp (newest first)
    filteredEntries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Apply pagination
    return filteredEntries.slice(offset, offset + limit);
  }
  
  /**
   * Get audit summary
   * @param {string} timeframe - Timeframe for summary ('day', 'week', 'month')
   * @returns {Object} - Audit summary
   */
  getAuditSummary(timeframe = 'day') {
    if (!this.options.enabled) {
      return {};
    }
    
    const now = new Date();
    let cutoffDate;
    
    // Calculate cutoff date based on timeframe
    switch (timeframe) {
      case 'week':
        cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'day':
      default:
        cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() - 1);
    }
    
    // Filter entries by timeframe
    const recentEntries = this.auditTrail.filter(entry => 
      new Date(entry.timestamp) >= cutoffDate);
    
    // Count by type
    const countByType = {};
    Object.values(AUDIT_EVENT_TYPES).forEach(type => {
      countByType[type] = recentEntries.filter(entry => entry.type === type).length;
    });
    
    // Count by severity
    const countBySeverity = {};
    Object.values(AUDIT_SEVERITY).forEach(severity => {
      countBySeverity[severity] = recentEntries.filter(entry => 
        entry.data && entry.data.severity === severity).length;
    });
    
    return {
      timeframe,
      totalEntries: recentEntries.length,
      countByType,
      countBySeverity,
      generatedAt: now.toISOString()
    };
  }
  
  /**
   * Clear audit trail
   * @returns {boolean} - Whether the audit trail was cleared
   */
  clearAuditTrail() {
    if (!this.options.enabled) {
      return false;
    }
    
    // Log clear event before clearing
    this.logEvent('system', {
      action: 'audit_trail_cleared',
      severity: AUDIT_SEVERITY.WARNING,
      previousEntryCount: this.auditTrail.length
    });
    
    // Clear audit trail
    this.auditTrail = [];
    
    // Emit clear event
    this.emit('audit:cleared');
    
    return true;
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfiguration(newConfig) {
    const oldEnabled = this.options.enabled;
    
    this.options = {
      ...this.options,
      ...newConfig
    };
    
    // Log configuration change
    this.logEvent('system', {
      action: 'audit_configuration_updated',
      severity: AUDIT_SEVERITY.INFO,
      changes: Object.keys(newConfig).join(',')
    });
    
    // Emit configuration updated event
    this.emit('config:updated', this.options);
    
    // If audit trail was disabled and is now enabled, log an event
    if (!oldEnabled && this.options.enabled) {
      this.logEvent('system', {
        action: 'audit_trail_enabled',
        severity: AUDIT_SEVERITY.INFO
      });
    }
  }
  
  /**
   * Export audit trail
   * @param {Object} filters - Filters to apply
   * @returns {Object} - Exportable audit trail
   */
  exportAuditTrail(filters = {}) {
    if (!this.options.enabled) {
      return { entries: [], count: 0 };
    }
    
    const entries = this.getAuditEntries(filters, this.auditTrail.length, 0);
    
    const exportData = {
      entries,
      count: entries.length,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    // Log export event
    this.logEvent('system', {
      action: 'audit_trail_exported',
      severity: AUDIT_SEVERITY.INFO,
      entryCount: entries.length
    });
    
    return exportData;
  }
}

// Export constants and class
export {
  AUDIT_EVENT_TYPES,
  AUDIT_SEVERITY,
  AuditTrail
};

// Create and export default instance
const auditTrail = new AuditTrail();
export { auditTrail };
