/**
 * fallacy-detector.js
 * Detects common logical fallacies in reasoning content.
 */
import { publish } from '../../core/events.js';

const FALLACIES = [
  { id: 'ad_hominem', pattern: /\byou (are|were) a .*? therefore .*/i, description: 'Ad Hominem' },
  { id: 'slippery_slope', pattern: /\bif .+ then inevitably .*/i, description: 'Slippery Slope' },
  { id: 'strawman', pattern: /\bso you think .+ therefore .*/i, description: 'Strawman' }
];

/**
 * Analyze text for logical fallacies.
 * @param {string} text - Text to analyze
 * @returns {Array<Object>} List of detected fallacies
 */
export function detectFallacies(text) {
  const detected = [];
  for (const f of FALLACIES) {
    if (f.pattern.test(text)) {
      detected.push({ id: f.id, description: f.description });
    }
  }
  publish('reasoning:fallacies-detected', { text, detected });
  return detected;
}
