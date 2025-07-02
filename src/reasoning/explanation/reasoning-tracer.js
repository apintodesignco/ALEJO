/**
 * reasoning-tracer.js
 * Creates audit trails for reasoning steps.
 */
import { publish } from '../../core/events.js';

const traces = [];

/**
 * Record a reasoning step.
 * @param {Object} step - Description of the reasoning step
 */
export function traceStep(step) {
  const entry = { timestamp: new Date().toISOString(), step };
  traces.push(entry);
  publish('reasoning:step-traced', entry);
}

/**
 * Get all traced steps.
 * @returns {Array<Object>}
 */
export function getTrace() {
  return [...traces];
}

/**
 * Clear the reasoning trace.
 */
export function clearTrace() {
  traces.length = 0;
  publish('reasoning:trace-cleared');
}
