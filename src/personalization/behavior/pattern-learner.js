/**
 * pattern-learner.js
 * Learns user communication patterns over time.
 */
import { subscribe, publish } from '../../core/events.js';

const userPatterns = new Map();

/**
 * Record a user's message and update pattern frequencies.
 * @param {string} userId
 * @param {string} message
 */
function recordMessage(userId, message) {
  if (!userPatterns.has(userId)) {
    userPatterns.set(userId, {});
  }
  const freq = userPatterns.get(userId);
  const words = message.toLowerCase().split(/\W+/).filter(Boolean);
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  publish('behavior:pattern-updated', { userId, patterns: { ...freq } });
}

/**
 * Get learned patterns for a user.
 * @param {string} userId
 * @returns {Object} word frequency map
 */
export function getPatterns(userId) {
  return { ...(userPatterns.get(userId) || {}) };
}

/**
 * Initialize the pattern learner by subscribing to conversation events.
 */
export function initialize(options = {}) {
  subscribe('conversation:message', ({ userId, message }) => {
    recordMessage(userId, message);
  });
  publish('behavior:pattern-learner:initialized', {});
}
