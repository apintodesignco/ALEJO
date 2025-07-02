/**
 * adaptor.js
 * Adjusts ALEJO's responses based on user communication patterns.
 */
import { subscribe, publish } from '../../core/events.js';
import { getPatterns } from './pattern-learner.js';

/**
 * Generate an adaptive response style for a user.
 * @param {string} userId
 * @param {string} response
 * @returns {string} styled response
 */
function adaptResponse(userId, response) {
  const patterns = getPatterns(userId);
  // Find the most frequent word
  const frequentWord = Object.entries(patterns)
    .sort((a,b) => b[1]-a[1])[0]?.[0];
  if (!frequentWord) return response;
  // Simple adaptation: append a nod to user's style
  return `${response} BTW, I noticed you often say "${ frequentWord }".`;
}

/**
 * Initialize the adaptor by listening for responses.
 */
export function initialize() {
  subscribe('conversation:response', ({ userId, response }) => {
    const adapted = adaptResponse(userId, response);
    publish('conversation:response:adapted', { userId, response: adapted });
  });
  publish('behavior:adaptor:initialized', {});
}
