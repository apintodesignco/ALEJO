/**
 * entity-tracker.js
 * Recognizes personal entities in conversations and tracks them in personal-graph.
 */
import { subscribe, publish } from '../../core/events.js';
import { upsertNode, addEdge } from './personal-graph.js';

// Simple regex-based entity detection
const ENTITY_PATTERNS = {
  person: /\b([A-Z][a-z]+\s[A-Z][a-z]+)\b/g,
  place: /\b(in|at)\s([A-Z][a-z]+)\b/g
};

/**
 * Extract and track entities from a message
 * @param {string} userId
 * @param {string} message
 */
function trackEntities(userId, message) {
  let match;
  // Track persons
  while ((match = ENTITY_PATTERNS.person.exec(message))) {
    const name = match[1];
    upsertNode(name, 'person', { detectedAt: Date.now() });
    addEdge(userId, name, 'knows');
  }
  // Track places
  while ((match = ENTITY_PATTERNS.place.exec(message))) {
    const place = match[2];
    upsertNode(place, 'place', { detectedAt: Date.now() });
    addEdge(userId, place, 'visited');
  }
  publish('memory:entities-tracked', { userId, message });
}

/**
 * Initialize entity tracker
 */
export function initialize() {
  subscribe('conversation:message', ({ userId, message }) => {
    trackEntities(userId, message);
  });
  publish('memory:entity-tracker:initialized', {});
}
