/**
 * ConsolidationCenter orchestrates periodic consolidation of short-term data sources into long-term memory.
 */

import { internalNarrative } from '../consciousness/internal-narrative.js';
import { dreamStateGenerator } from '../cognition/dream-state-generator.js';
import { syntheticIntuitionSystem } from '../cognition/synthetic-intuition-system.js';
import { createMemory } from './memory-schema.js';
import { scoreMemory } from './memory-utils.js';
import { longTermStore } from './long-term-store.js';
import { ConsentManager } from '../security/consent-manager.js';
import { AuditTrail } from '../security/audit-trail.js';

class ConsolidationCenter {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await longTermStore.initialize();
    this.consent = new ConsentManager();
    await this.consent.initialize();
    this.audit = new AuditTrail();
    await this.audit.initialize();
    this.initialized = true;
  }

  async consolidateNow() {
    await this.initialize();

    // Collect recent items (last 60 minutes)
    const since = Date.now() - 60 * 60 * 1000;
    const narrativeEntries = internalNarrative.exportRecent(since);
    const dreams = dreamStateGenerator.getRecentDreams(since);
    const insights = syntheticIntuitionSystem.getRecentInsights(since);

    const items = [
      ...narrativeEntries.map(e => createMemory({ type: 'observation', content: e.text, tags: e.tags, timestamp: e.timestamp })),
      ...dreams.map(d => createMemory({ type: 'dream', content: d.description, tags: ['dream'], timestamp: d.timestamp })),
      ...insights.map(i => createMemory({ type: 'insight', content: i.text, tags: ['insight'], timestamp: i.timestamp }))
    ];

    for (const mem of items) {
      mem.importance = scoreMemory(mem);
      if (!this.consent.canStore(mem)) continue; // skip if user disallowed
      await longTermStore.save(mem);
      this.audit.log('memory_consolidated', { id: mem.id, importance: mem.importance });
    }
  }
}

export const consolidationCenter = new ConsolidationCenter();
