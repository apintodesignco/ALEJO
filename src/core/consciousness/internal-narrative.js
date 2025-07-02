/**
 * ALEJO Internal Narrative Module
 *
 * Extended version that supports detailed logging, querying, filtering,
 * and integration with persistent storage if needed. This module maintains
 * a timeline of internal thoughts and events for introspection and debugging.
 */

class InternalNarrative {
  constructor() {
    // Store narrative entries as an array of objects
    this.narrative = [];
  }

  /**
   * Log a new narrative entry with optional tags and metadata.
   * @param {string} message - The narrative message.
   * @param {Array<string>} [tags] - Tags for categorization.
   * @param {object} [metadata] - Additional metadata.
   */
  log(message, tags = [], metadata = {}) {
    const entry = {
      message,
      tags,
      timestamp: Date.now(),
      ...metadata
    };
    this.narrative.push(entry);
    console.log('[Narrative]', entry);
  }

  /**
   * Retrieve the full narrative.
   * @returns {Array<object>}
   */
  getNarrative() {
    return this.narrative;
  }

  /**
   * Filter narrative entries by a given tag.
   * @param {string} tag
   * @returns {Array<object>}
   */
  filterByTag(tag) {
    return this.narrative.filter(entry => entry.tags.includes(tag));
  }

  /**
   * Search for a keyword in narrative messages.
   * @param {string} keyword
   * @returns {Array<object>}
   */
  search(keyword) {
    return this.narrative.filter(entry => entry.message.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Clear all narrative entries.
   */
  clear() {
    this.narrative = [];
    console.log('[Narrative] Cleared all entries.');
  }
}

  log(message, metadata = {}) {
    const entry = {
      message,
      timestamp: Date.now(),
      ...metadata
    };
    this.narrative.push(entry);
    console.log('[Narrative]', entry);
  }

  /**
   * Retrieve the full internal narrative.
   * @returns {Array} Array of narrative entries.
   */
  getNarrative() {
    return this.narrative;
  }

  /**
   * Clear the stored narrative entries.
   */
  clear() {
    this.narrative = [];
    console.log('[Narrative] Cleared internal narrative.');
  }
}

// Export a singleton instance for global use
export const internalNarrative = new InternalNarrative();

// Example usage:
// internalNarrative.log('System initialized', ['system']);

// Example usage:
// internalNarrative.log('System initialized with preliminary consciousness module.');
