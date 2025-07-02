/**
 * feedback-loop.js
 * Allows user feedback to correct reasoning steps.
 */
import { subscribe, publish } from '../../core/events.js';

const corrections = [];

/**
 * Handle user feedback to a reasoning step.
 * @param {Object} data - { stepId, correction, userId }
 */
function handleFeedback(data) {
  const entry = { ...data, timestamp: new Date().toISOString() };
  corrections.push(entry);
  publish('reasoning:feedback-recorded', entry);
}

/**
 * Initialize feedback loop listener.
 */
export function initialize() {
  subscribe('reasoning:user-feedback', handleFeedback);
  publish('reasoning:feedback-loop:initialized');
}

/**
 * Retrieve all feedback entries.
 * @returns {Array<Object>}
 */
export function getCorrections() {
  return [...corrections];
}
