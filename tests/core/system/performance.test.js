/**
 * Performance Test Suite for Initialization System
 * 
 * Tests the performance characteristics of the initialization system under various conditions:
 * - Large number of components
 * - Different resource constraints
 * - Various component priorities and dependencies
 * - Initialization with and without fallbacks
 */

import { 
  registerComponent,
  unregisterComponent,
  initializeSystem,
  getInitializationStatus
} from '../../../src/core/system/initialization-manager.js';

import {
  registerFallbackImplementation,
  getFallbackStatistics
} from '../../../src/core/system/fallback-manager.js';

import {
  initializeProgressiveLoading,
  getLoadingSequenceState,
  loadDeferredComponents
} from '../../../src/core/system/progressive-loading-manager.js';

import {
  logInitEvent,
  getInitLogs,
  generateTimelineData
} from '../../../src/core/system/initialization-log-viewer.js';

// Mock the event bus
jest.mock('../../../src/core/events/event-bus.js', () => ({
  publishEvent: jest.fn(),
  subscribeToEvent: jest.fn(),
  unsubscribeFromEvent: jest.fn()
}));

// Performance measurement utilities
const measurePerformance = async (testFn, iterations = 1) => {
  const startTime = performance.now();
  for (let i = 0; i < iterations; i++) {
    await testFn();
  }
  const endTime = performance.now();
  return {
    totalTime: endTime - startTime,
    averageTime: (endTime - startTime) / iterations
  };
};

// Helper to generate a large number of components
const generateComponents = (count, options = {}) => {
  const {
    failureRate = 0,
    delayMs = 0,
    priorityRange = { min: 1, max: 100 },
    essentialRate = 0.2,
    accessibilityRate = 0.1
  } = options;
  
  const components = [];
  
  for (let i = 0; i < count; i++) {
    const shouldFail = Math.random() < failureRate;
    const isEssential = Math.random() < essentialRate;
    const isAccessibility = Math.random() < accessibilityRate;
    const priority = Math.floor(Math.random() * 
      (priorityRange.max - priorityRange.min + 1)) + priorityRange.min;
    
    components.push({
      id: `test.component${i}`,
      initialize: jest.fn().mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (shouldFail) {
              reject(new Error(`Component ${i} failed`));
            } else {
              resolve(true);
            }
          }, delayMs);
        });
      }),
      priority,
      isEssential,
      isAccessibility
    });
  }
  
  return components;
};

describe('Initialization System Performance', () => {
  // Reset all modules before each test
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ doNotFake: ['performance'] });
    
    // Clear any registered components
    const registeredComponents = getInitializationStatus().componentStatus || {};
    Object.keys(registeredComponents).forEach(componentId => {
      unregisterComponent(componentId);
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Component Registration Performance', () => {
    test('should efficiently register a large number of components', async () => {
      // Arrange
      const componentCount = 1000;
      const components = generateComponents(componentCount);
      
      // Act - Measure registration performance
      const { averageTime } = await measurePerformance(() => {
        components.forEach(component => {
          registerComponent(component);
        });
      });
      
      // Assert
      console.log(`Average time to register ${componentCount} components: ${averageTime.toFixed(2)}ms`);
      expect(averageTime).toBeLessThan(1000); // Should register 1000 components in less than 1 second
      
      // Verify all components were registered
      const status = getInitializationStatus();
      expect(Object.keys(status.componentStatus || {}).length).toBe(componentCount);
    });
    
    test('should efficiently unregister components', async () => {
      // Arrange - Register components first
      const componentCount = 500;
      const components = generateComponents(componentCount);
      components.forEach(component => {
        registerComponent(component);
      });
      
      // Act - Measure unregistration performance
      const { averageTime } = await measurePerformance(() => {
        components.forEach(component => {
          unregisterComponent(component.id);
        });
      });
      
      // Assert
      console.log(`Average time to unregister ${componentCount} components: ${averageTime.toFixed(2)}ms`);
      expect(averageTime).toBeLessThan(500); // Should unregister 500 components in less than 500ms
      
      // Verify all components were unregistered
      const status = getInitializationStatus();
      expect(Object.keys(status.componentStatus || {}).length).toBe(0);
    });
  });

  describe('Initialization Performance', () => {
    test('should efficiently initialize components with no delays', async () => {
      // Arrange
      const componentCount = 100;
      const components = generateComponents(componentCount, { delayMs: 0 });
      components.forEach(component => {
        registerComponent(component);
      });
      
      // Act - Measure initialization performance
      const { totalTime } = await measurePerformance(async () => {
        await initializeProgressiveLoading();
        await initializeSystem();
      });
      
      // Assert
      console.log(`Time to initialize ${componentCount} components with no delays: ${totalTime.toFixed(2)}ms`);
      expect(totalTime).toBeLessThan(500); // Should initialize 100 components in less than 500ms
      
      // Verify all components were initialized
      const status = getInitializationStatus();
      const initializedCount = Object.values(status.componentStatus || {})
        .filter(comp => comp.status === 'initialized').length;
      expect(initializedCount).toBe(componentCount);
    });
    
    test('should efficiently handle component failures and fallbacks', async () => {
      // Arrange
      const componentCount = 50;
      const components = generateComponents(componentCount, { 
        failureRate: 0.3,
        delayMs: 0
      });
      
      // Register components and fallbacks
      components.forEach(component => {
        registerComponent(component);
        
        // Register fallbacks for all components
        registerFallbackImplementation(component.id, jest.fn().mockResolvedValue(true), {
          preservesAccessibility: component.isAccessibility,
          performance: 'reduced'
        });
      });
      
      // Act - Measure initialization with fallbacks
      const { totalTime } = await measurePerformance(async () => {
        await initializeProgressiveLoading();
        await initializeSystem();
      });
      
      // Assert
      console.log(`Time to initialize ${componentCount} components with 30% failures and fallbacks: ${totalTime.toFixed(2)}ms`);
      expect(totalTime).toBeLessThan(500); // Should handle fallbacks efficiently
      
      // Verify fallbacks were used
      const fallbackStats = getFallbackStatistics();
      expect(fallbackStats.componentsUsingFallbacks.length).toBeGreaterThan(0);
    });
    
    test('should efficiently handle deferred loading', async () => {
      // Arrange - Set up components with varied priorities
      const essentialCount = 20;
      const nonEssentialCount = 30;
      
      const essentialComponents = generateComponents(essentialCount, {
        essentialRate: 1.0, // All essential
        priorityRange: { min: 70, max: 100 }
      });
      
      const nonEssentialComponents = generateComponents(nonEssentialCount, {
        essentialRate: 0, // None essential
        priorityRange: { min: 10, max: 60 }
      });
      
      // Register all components
      [...essentialComponents, ...nonEssentialComponents].forEach(component => {
        registerComponent(component);
      });
      
      // Act - Measure initial loading and deferred loading
      let initialLoadTime, deferredLoadTime;
      
      // Initial loading
      initialLoadTime = (await measurePerformance(async () => {
        await initializeProgressiveLoading();
        await initializeSystem({ deferNonEssential: true });
      })).totalTime;
      
      // Get deferred components
      const loadingState = getLoadingSequenceState();
      const deferredCount = loadingState.deferredComponents.length;
      
      // Deferred loading
      deferredLoadTime = (await measurePerformance(async () => {
        await loadDeferredComponents();
      })).totalTime;
      
      // Assert
      console.log(`Initial loading time (${essentialCount} essential components): ${initialLoadTime.toFixed(2)}ms`);
      console.log(`Deferred loading time (${deferredCount} non-essential components): ${deferredLoadTime.toFixed(2)}ms`);
      
      // Initial loading should be faster than loading everything at once
      const combinedTime = initialLoadTime + deferredLoadTime;
      console.log(`Combined loading time: ${combinedTime.toFixed(2)}ms`);
      
      // Verify all components were eventually initialized
      const status = getInitializationStatus();
      const initializedCount = Object.values(status.componentStatus || {})
        .filter(comp => comp.status === 'initialized').length;
      expect(initializedCount).toBe(essentialCount + nonEssentialCount);
    });
  });

  describe('Logging and Timeline Performance', () => {
    test('should efficiently log and process a large number of initialization events', async () => {
      // Arrange - Generate a large number of log events
      const eventCount = 500;
      const events = [];
      
      for (let i = 0; i < eventCount; i++) {
        events.push({
          type: i % 5 === 0 ? 'error' : i % 4 === 0 ? 'warning' : 'info',
          componentId: `test.component${i % 50}`,
          timestamp: Date.now() + i * 10,
          details: `Event ${i} details`
        });
      }
      
      // Act - Measure logging performance
      const loggingTime = (await measurePerformance(() => {
        events.forEach(event => {
          logInitEvent(event);
        });
      })).totalTime;
      
      // Measure retrieval performance
      const retrievalTime = (await measurePerformance(() => {
        getInitLogs();
      })).totalTime;
      
      // Measure timeline generation performance
      const timelineGenerationTime = (await measurePerformance(() => {
        generateTimelineData();
      })).totalTime;
      
      // Assert
      console.log(`Time to log ${eventCount} events: ${loggingTime.toFixed(2)}ms`);
      console.log(`Time to retrieve ${eventCount} events: ${retrievalTime.toFixed(2)}ms`);
      console.log(`Time to generate timeline data: ${timelineGenerationTime.toFixed(2)}ms`);
      
      // Performance expectations
      expect(loggingTime).toBeLessThan(500); // Should log 500 events in less than 500ms
      expect(retrievalTime).toBeLessThan(50); // Should retrieve logs quickly
      expect(timelineGenerationTime).toBeLessThan(200); // Should generate timeline data quickly
      
      // Verify all events were logged
      const logs = getInitLogs();
      expect(logs.length).toBe(eventCount);
    });
    
    test('should efficiently filter logs', async () => {
      // Arrange - Generate and log a large number of events
      const eventCount = 1000;
      const componentIds = ['comp1', 'comp2', 'comp3', 'comp4', 'comp5'];
      const eventTypes = ['info', 'warning', 'error', 'success', 'debug'];
      
      for (let i = 0; i < eventCount; i++) {
        logInitEvent({
          type: eventTypes[i % eventTypes.length],
          componentId: componentIds[i % componentIds.length],
          timestamp: Date.now() + i * 5,
          details: `Event ${i} details`
        });
      }
      
      // Act - Measure filtering performance for different filter combinations
      const typeFilterTime = (await measurePerformance(() => {
        return getInitLogs().filter(log => log.type === 'error');
      })).totalTime;
      
      const componentFilterTime = (await measurePerformance(() => {
        return getInitLogs().filter(log => log.componentId === 'comp1');
      })).totalTime;
      
      const combinedFilterTime = (await measurePerformance(() => {
        return getInitLogs().filter(log => 
          log.type === 'error' && log.componentId === 'comp1'
        );
      })).totalTime;
      
      // Assert
      console.log(`Time to filter ${eventCount} logs by type: ${typeFilterTime.toFixed(2)}ms`);
      console.log(`Time to filter ${eventCount} logs by component: ${componentFilterTime.toFixed(2)}ms`);
      console.log(`Time to filter ${eventCount} logs by type and component: ${combinedFilterTime.toFixed(2)}ms`);
      
      // Performance expectations
      expect(typeFilterTime).toBeLessThan(50); // Should filter quickly
      expect(componentFilterTime).toBeLessThan(50);
      expect(combinedFilterTime).toBeLessThan(50);
    });
  });

  describe('Memory Usage', () => {
    test('should maintain reasonable memory usage with a large number of components', async () => {
      // This test can only provide relative measurements since Jest doesn't expose memory usage
      
      // Arrange - Generate a large number of components and events
      const componentCount = 500;
      const eventCount = 1000;
      
      // Register components
      const components = generateComponents(componentCount);
      components.forEach(component => {
        registerComponent(component);
      });
      
      // Log events
      for (let i = 0; i < eventCount; i++) {
        logInitEvent({
          type: i % 5 === 0 ? 'error' : i % 4 === 0 ? 'warning' : 'info',
          componentId: `test.component${i % componentCount}`,
          timestamp: Date.now() + i * 10,
          details: `Event ${i} details with some additional text to increase memory usage slightly`
        });
      }
      
      // Act - Initialize system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Generate timeline data
      const timelineData = generateTimelineData();
      
      // Assert
      // We can't directly measure memory usage in Jest, but we can check that operations complete
      expect(timelineData.length).toBeGreaterThan(0);
      
      // Check that we can still access all components and logs
      const status = getInitializationStatus();
      expect(Object.keys(status.componentStatus || {}).length).toBe(componentCount);
      
      const logs = getInitLogs();
      expect(logs.length).toBe(eventCount);
      
      // This test passes if it completes without out-of-memory errors
      console.log(`Successfully processed ${componentCount} components and ${eventCount} events`);
    });
  });
});
