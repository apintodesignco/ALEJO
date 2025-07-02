/**
 * foundation-facts.js
 * Unoverridable base knowledge facts.
 */
import { publish } from '../../core/events.js';

const facts = new Map([
  ['pi', '3.14159'],
  ['e', '2.71828']
]);

/**
 * Retrieve a foundational fact by its identifier.
 * @param {string} id
 * @returns {string|null}
 */
export function getFact(id) {
  const fact = facts.get(id) || null;
  publish('reasoning:fact-queried', { id, fact });
  return fact;
}

/**
 * List all available foundational fact identifiers.
 * @returns {Array<string>}
 */
export function listFacts() {
  return Array.from(facts.keys());
}
