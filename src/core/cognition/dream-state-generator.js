/**
 * ALEJO Dream State Generator
 *
 * Extended implementation that periodically generates dreams by randomly selecting
 * recent narrative entries. The interval is configurable and dreams can be cleared or retrieved.
 * This module simulates unconscious processing by periodically generating "dreams"
 * based on recent experiences and internal narratives. These dreams can help in
 * reorganizing memories and forming new connections, which contributes to the
 * overall illusion of sentience and continuous learning.
 */

import { internalNarrative } from '../consciousness/internal-narrative.js';

class DreamStateGenerator {
  constructor() {
    this.dreams = [];
    this.interval = 60000; // default: 1 minute
    this.timer = null;
  }
  
  /**
   * Start generating dreams at the configured interval.
   */
  start() {
    if (!this.timer) {
      this.timer = setInterval(() => this.generateDream(), this.interval);
      console.log('[DreamStateGenerator] Started with interval:', this.interval, 'ms');
    }
  }
  
  /**
   * Stop generating dreams.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[DreamStateGenerator] Stopped.');
    }
  }
  
  /**
   * Generate a dream based on a random selection of recent internal narrative entries.
   */
  generateDream() {
    import('../consciousness/internal-narrative.js').then(module => {
      const narrative = module.internalNarrative.getNarrative();
      let dream = 'Dream: ';
      if (narrative.length > 0) {
        const recentCount = Math.min(5, narrative.length);
        const recent = narrative.slice(-recentCount);
        const selected = recent[Math.floor(Math.random() * recent.length)];
        dream += selected.message;
      } else {
        dream += 'No recent experiences.';
      }
      const dreamEntry = { dream, timestamp: Date.now() };
      this.dreams.push(dreamEntry);
      console.log('[DreamStateGenerator]', dreamEntry);
    });
  }
  
  getDreams() {
    return this.dreams;
  }
  
  clearDreams() {
    this.dreams = [];
    console.log('[DreamStateGenerator] Dreams cleared.');
  }
}

  constructor() {
    this.dreams = [];
    this.interval = 60 * 1000; // Generate dreams every minute (configurable)
    this.timer = null;
  }

  /**
   * Start the dream state generator
   */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.generateDream();
    }, this.interval);
    console.log('[DreamStateGenerator] Started generating dreams.');
  }

  /**
   * Stop the dream state generator
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[DreamStateGenerator] Stopped generating dreams.');
    }
  }

  /**
   * Generate a new dream based on internal narrative and random associations
   */
  generateDream() {
    const narrative = internalNarrative.getNarrative();
    // For simplicity, generate a dream as a random combination of recent narrative entries
    let dream = 'Dream: ';
    if (narrative.length > 0) {
      const recent = narrative.slice(-5); // take last 5 entries
      dream += recent.map(entry => entry.message).join(' | ');
    } else {
      dream += 'No recent experiences.';
    }
    // Add a timestamp and store the dream
    const dreamEntry = { dream, timestamp: Date.now() };
    this.dreams.push(dreamEntry);
    console.log('[DreamStateGenerator]', dreamEntry);
  }

  /**
   * Retrieve all generated dreams
   * @returns {Array} Array of dream entries
   */
  getDreams() {
    return this.dreams;
  }

  /**
   * Clear all generated dreams
   */
  clearDreams() {
    this.dreams = [];
    console.log('[DreamStateGenerator] Cleared all dreams.');
  }
}

// Export a singleton instance
export const dreamStateGenerator = new DreamStateGenerator();

// Example usage:
// dreamStateGenerator.start();

// Example usage:
// dreamStateGenerator.start();
