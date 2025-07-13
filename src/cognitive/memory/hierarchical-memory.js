export class HierarchicalMemory {
  constructor() {
    this.episodic = [];
    this.semantic = {};
    this.procedural = [];
    this.importanceWeights = {
      episodic: 0.7,
      semantic: 0.9,
      procedural: 0.8
    };
  }

  recordEvent(event) {
    this.episodic.push({
      ...event,
      timestamp: Date.now(),
      weight: this._calculateWeight(event)
    });
  }

  storeFact(key, fact) {
    this.semantic[key] = {
      fact,
      lastAccessed: Date.now(),
      accessCount: 0
    };
  }

  _calculateWeight(event) {
    const emotionalWeight = event.emotionalIntensity || 1;
    return emotionalWeight * this.importanceWeights.episodic;
  }

  recallRelevantEvents(context) {
    return this.episodic.filter(event => 
      event.tags.some(tag => context.tags.includes(tag))
    ).sort((a, b) => b.weight - a.weight);
  }
}
