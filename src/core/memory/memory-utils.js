/**
 * Utility functions for scoring, decay, and retrieval of memories.
 */

import { MemoryTypes } from './memory-schema.js';

/** Basic importance scoring heuristic. */
export function scoreMemory(memory) {
  let score = memory.importance || 1;
  const ageMinutes = (Date.now() - memory.timestamp) / 60000;
  if (ageMinutes < 5) score += 2; // recency boost
  if (memory.tags.includes('emotion')) score += 1;
  return Math.min(score, 5);
}

/** Apply exponential decay to importance based on age (days). */
export function decayImportance(memory, halfLifeDays = 30) {
  const ageDays = (Date.now() - memory.timestamp) / (86400 * 1000);
  const decayFactor = Math.pow(0.5, ageDays / halfLifeDays);
  return memory.importance * decayFactor;
}

/** Simple in-memory index support (placeholder for future retrieval AI). */
export function filterMemories(memories, { tags = [], type = null } = {}) {
  return memories.filter(m =>
    (type ? m.type === type : true) &&
    (tags.length ? tags.every(tag => m.tags.includes(tag)) : true)
  );
}
