/**
 * audit-trail.js
 * Records secure activity logs with timestamp and event details.
 */
import { publish } from '../../core/events.js';

const STORAGE_KEY = 'alejo-audit-trail';
let logs = [];

/**
 * Initialize audit trail by loading from localStorage.
 */
export function initialize() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    logs = stored ? JSON.parse(stored) : [];
    publish('security:audit-trail:initialized', { count: logs.length });
    return true;
  } catch (error) {
    console.error('AuditTrail initialization failed:', error);
    return false;
  }
}

/**
 * Log an event to the audit trail.
 * @param {string} eventType
 * @param {Object} details
 */
export function logEvent(eventType, details={}) {
  const entry = {
    timestamp: new Date().toISOString(),
    eventType,
    details
  };
  logs.push(entry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {}
  publish('security:audit-trail:entry-logged', entry);
}

/**
 * Retrieve all audit logs.
 * @returns {Array}
 */
export function getLogs() {
  return [...logs];
}
