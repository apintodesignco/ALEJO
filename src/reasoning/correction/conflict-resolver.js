/**
 * conflict-resolver.js
 * Handles contradictions in knowledge by selecting a resolution.
 */
import { publish } from '../../core/events.js';

/**
 * Resolve a conflict between existing and proposed facts.
 * @param {{ key: string, existing: any, proposed: any }} conflict
 * @returns {any} resolution
 */
export function resolveConflict(conflict) {
  // Prefer foundational or existing knowledge over proposed by default
  const resolution = conflict.existing;
  publish('reasoning:conflict-resolved', { conflict, resolution });
  return resolution;
}
