/**
 * source-validator.js
 * Evaluates reliability of information sources.
 */
import { publish } from '../../core/events.js';

// Simple reliability scores
const SCORES = {
  'wikipedia.org': 0.8,
  'example.com': 0.4
};

/**
 * Validate a source URL.
 * @param {string} url
 * @returns {number} reliability score (0-1)
 */
export function validateSource(url) {
  let score = 0.5;
  try {
    const domain = (new URL(url)).hostname;
    score = SCORES[domain] || 0.5;
  } catch {}
  publish('reasoning:source-validated', { url, score });
  return score;
}
