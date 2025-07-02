/**
 * Memory Schema definitions for ALEJO long-term storage.
 * Provides helper to create typed memory objects.
 */

export const MemoryTypes = Object.freeze({
  OBSERVATION: 'observation',
  REFLECTION: 'reflection',
  DREAM: 'dream',
  INSIGHT: 'insight',
  GOAL: 'goal',
  SKILL: 'skill'
});

/**
 * Create a new standardised memory object.
 * @param {Object} params
 * @param {string} params.type - One of MemoryTypes
 * @param {string} params.content - Human-readable content
 * @param {string[]} [params.tags] - Optional tags
 * @param {number} [params.timestamp] - Epoch ms (defaults to now)
 * @param {number} [params.importance] - 1-5 importance score
 * @param {Object} [params.metadata] - Additional structured data
 * @returns {MemoryObject}
 */
export function createMemory({
  type,
  content,
  tags = [],
  timestamp = Date.now(),
  importance = 1,
  metadata = {}
}) {
  if (!Object.values(MemoryTypes).includes(type)) {
    throw new Error(`Unknown memory type: ${type}`);
  }
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${type}-${timestamp}-${Math.random().toString(36).slice(2)}`;
  return { id, type, content, tags, timestamp, importance, metadata };
}

/**
 * @typedef {Object} MemoryObject
 * @property {string} id
 * @property {string} type
 * @property {string} content
 * @property {string[]} tags
 * @property {number} timestamp
 * @property {number} importance
 * @property {Object} metadata
 */
