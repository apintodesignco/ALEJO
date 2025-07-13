import { HierarchicalMemory } from '../../../src/cognitive/memory/hierarchical-memory';

describe('HierarchicalMemory', () => {
  let memory;

  beforeEach(() => {
    memory = new HierarchicalMemory();
  });

  test('records events with weights', () => {
    memory.recordEvent({
      type: 'interaction',
      emotionalIntensity: 0.9,
      tags: ['disney', 'guest']
    });
    
    expect(memory.episodic.length).toBe(1);
    expect(memory.episodic[0].weight).toBeCloseTo(0.63);
  });

  test('recalls relevant events by context', () => {
    memory.recordEvent({ tags: ['disney'] });
    memory.recordEvent({ tags: ['universal'] });
    
    const disneyEvents = memory.recallRelevantEvents({ tags: ['disney'] });
    expect(disneyEvents.length).toBe(1);
  });
});
