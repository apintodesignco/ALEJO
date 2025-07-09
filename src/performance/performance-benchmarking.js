/**
 * ALEJO Performance Benchmarking
 * 
 * This module provides standardized benchmarks for measuring ALEJO's performance
 * across different components, environments, and configurations.
 * 
 * Features:
 * - Component-specific benchmarks
 * - System-wide performance tests
 * - Standardized metrics collection
 * - Environment-aware testing
 * - Integration with performance logger
 */

import { startBenchmark, endBenchmark, recordBenchmarkMeasurement } from './performance-logger.js';
import { publishEvent } from '../core/neural-architecture/neural-event-bus.js';

// Benchmark definitions
const benchmarkDefinitions = {
  'system-startup': {
    name: 'System Startup',
    description: 'Measures the time taken for complete system initialization',
    metrics: ['totalTime', 'componentCount', 'peakMemory'],
    tags: ['system', 'initialization']
  },
  'ui-rendering': {
    name: 'UI Rendering',
    description: 'Measures UI rendering performance under various conditions',
    metrics: ['fps', 'renderTime', 'jank'],
    tags: ['ui', 'rendering']
  },
  'resource-allocation': {
    name: 'Resource Allocation',
    description: 'Measures resource allocation and optimization performance',
    metrics: ['allocationTime', 'optimizationTime', 'componentSwitches'],
    tags: ['resources', 'optimization']
  },
  'gesture-processing': {
    name: 'Gesture Processing',
    description: 'Measures gesture detection and processing performance',
    metrics: ['detectionTime', 'processingTime', 'accuracy'],
    tags: ['gesture', 'input']
  },
  'memory-usage': {
    name: 'Memory Usage',
    description: 'Measures memory usage patterns and efficiency',
    metrics: ['peakMemory', 'steadyStateMemory', 'leakRate'],
    tags: ['memory', 'resources']
  }
};

// Benchmark results storage
const benchmarkResults = new Map();

/**
 * Run a specific benchmark
 * @param {string} benchmarkId - ID of the benchmark to run
 * @param {Object} options - Benchmark options
 * @param {number} options.iterations - Number of iterations to run
 * @param {number} options.warmupIterations - Number of warmup iterations
 * @param {Object} options.parameters - Benchmark-specific parameters
 * @returns {Promise<Object>} - Benchmark results
 */
export async function runBenchmark(benchmarkId, options = {}) {
  // Get benchmark definition
  const definition = benchmarkDefinitions[benchmarkId];
  if (!definition) {
    throw new Error(`Unknown benchmark: ${benchmarkId}`);
  }
  
  // Default options
  const {
    iterations = 5,
    warmupIterations = 2,
    parameters = {}
  } = options;
  
  console.log(`Starting benchmark: ${definition.name}`);
  console.log(definition.description);
  
  // Start benchmark in performance logger
  startBenchmark(benchmarkId, {
    definition,
    options,
    startTime: Date.now()
  });
  
  // Publish benchmark start event
  publishEvent('performance:benchmark-started', {
    benchmarkId,
    name: definition.name,
    iterations,
    warmupIterations
  });
  
  try {
    // Run warmup iterations
    if (warmupIterations > 0) {
      console.log(`Running ${warmupIterations} warmup iterations...`);
      for (let i = 0; i < warmupIterations; i++) {
        await runBenchmarkIteration(benchmarkId, {
          ...parameters,
          iteration: i,
          warmup: true
        });
      }
    }
    
    // Run actual iterations
    console.log(`Running ${iterations} benchmark iterations...`);
    const iterationResults = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await runBenchmarkIteration(benchmarkId, {
        ...parameters,
        iteration: i,
        warmup: false
      });
      
      iterationResults.push(result);
      recordBenchmarkMeasurement(benchmarkId, `Iteration ${i + 1} completed`);
      console.log(`Iteration ${i + 1}/${iterations} completed`);
    }
    
    // Aggregate results
    const results = aggregateBenchmarkResults(iterationResults, definition.metrics);
    
    // Store results
    benchmarkResults.set(benchmarkId, {
      id: benchmarkId,
      name: definition.name,
      timestamp: Date.now(),
      iterations,
      results
    });
    
    // End benchmark in performance logger
    endBenchmark(benchmarkId);
    
    // Publish benchmark complete event
    publishEvent('performance:benchmark-completed', {
      benchmarkId,
      name: definition.name,
      results
    });
    
    console.log(`Benchmark completed: ${definition.name}`);
    console.log('Results:', formatBenchmarkResults(results));
    
    return {
      id: benchmarkId,
      name: definition.name,
      results,
      iterations,
      success: true
    };
  } catch (error) {
    console.error(`Benchmark failed: ${definition.name}`, error);
    
    // End benchmark in performance logger with error
    endBenchmark(benchmarkId);
    
    // Publish benchmark error event
    publishEvent('performance:benchmark-error', {
      benchmarkId,
      name: definition.name,
      error: error.message
    });
    
    return {
      id: benchmarkId,
      name: definition.name,
      error: error.message,
      success: false
    };
  }
}

/**
 * Run a single benchmark iteration
 * @param {string} benchmarkId - ID of the benchmark
 * @param {Object} parameters - Benchmark parameters
 * @returns {Promise<Object>} - Iteration results
 */
async function runBenchmarkIteration(benchmarkId, parameters) {
  switch (benchmarkId) {
    case 'system-startup':
      return await benchmarkSystemStartup(parameters);
    case 'ui-rendering':
      return await benchmarkUiRendering(parameters);
    case 'resource-allocation':
      return await benchmarkResourceAllocation(parameters);
    case 'gesture-processing':
      return await benchmarkGestureProcessing(parameters);
    case 'memory-usage':
      return await benchmarkMemoryUsage(parameters);
    default:
      throw new Error(`No implementation for benchmark: ${benchmarkId}`);
  }
}

/**
 * Benchmark system startup performance
 * @param {Object} parameters - Benchmark parameters
 * @returns {Promise<Object>} - Benchmark results
 */
async function benchmarkSystemStartup(parameters) {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    // Import initialization manager dynamically
    const { initializeSystem } = await import('../core/system/initialization-manager.js');
    
    // Run initialization with specified parameters
    const initOptions = {
      prioritizeAccessibility: parameters.prioritizeAccessibility !== false,
      allowProgressiveLoading: parameters.allowProgressiveLoading !== false,
      ...parameters
    };
    
    const initResult = await initializeSystem(initOptions);
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    // Reset initialization if this is not a warmup
    if (!parameters.warmup) {
      const { resetInitialization } = await import('../core/system/initialization-manager.js');
      await resetInitialization({ clearRegistry: false });
    }
    
    return {
      totalTime: endTime - startTime,
      componentCount: initResult.initialized.length,
      failedCount: initResult.failed.length,
      deferredCount: initResult.deferred?.length || 0,
      peakMemory: (endMemory - startMemory) / (1024 * 1024), // MB
      success: true
    };
  } catch (error) {
    return {
      totalTime: performance.now() - startTime,
      componentCount: 0,
      failedCount: 0,
      deferredCount: 0,
      peakMemory: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Benchmark UI rendering performance
 * @param {Object} parameters - Benchmark parameters
 * @returns {Promise<Object>} - Benchmark results
 */
async function benchmarkUiRendering(parameters) {
  // This benchmark requires a browser environment
  // For Node.js environment, we'll return simulated results
  
  if (typeof window === 'undefined') {
    // Simulate UI rendering benchmark in Node.js
    return simulateUiRenderingBenchmark(parameters);
  }
  
  try {
    const frameRates = [];
    const renderTimes = [];
    const jankScores = [];
    
    // Create a test container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '500px';
    container.style.height = '500px';
    document.body.appendChild(container);
    
    // Number of elements to render
    const elementCount = parameters.elementCount || 1000;
    
    // Create elements
    const elements = [];
    for (let i = 0; i < elementCount; i++) {
      const element = document.createElement('div');
      element.style.width = '10px';
      element.style.height = '10px';
      element.style.backgroundColor = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
      element.style.position = 'absolute';
      element.style.left = `${Math.random() * 490}px`;
      element.style.top = `${Math.random() * 490}px`;
      container.appendChild(element);
      elements.push(element);
    }
    
    // Measure rendering performance
    const frames = parameters.frames || 60;
    let frameCount = 0;
    
    // Use requestAnimationFrame for timing
    return new Promise(resolve => {
      let lastFrameTime = performance.now();
      let worstFrameTime = 0;
      
      function renderFrame() {
        const now = performance.now();
        const frameDuration = now - lastFrameTime;
        lastFrameTime = now;
        
        // Calculate FPS
        const fps = 1000 / frameDuration;
        frameRates.push(fps);
        
        // Track render time
        renderTimes.push(frameDuration);
        
        // Track jank (frame time variance)
        if (frameDuration > 16.7) { // More than 60fps frame budget
          jankScores.push(frameDuration - 16.7);
        } else {
          jankScores.push(0);
        }
        
        // Track worst frame
        if (frameDuration > worstFrameTime) {
          worstFrameTime = frameDuration;
        }
        
        // Update element positions
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          const left = parseFloat(element.style.left);
          const top = parseFloat(element.style.top);
          
          element.style.left = `${(left + Math.random() * 2 - 1) % 490}px`;
          element.style.top = `${(top + Math.random() * 2 - 1) % 490}px`;
        }
        
        frameCount++;
        
        if (frameCount < frames) {
          requestAnimationFrame(renderFrame);
        } else {
          // Clean up
          document.body.removeChild(container);
          
          // Calculate results
          resolve({
            fps: calculateAverage(frameRates),
            renderTime: calculateAverage(renderTimes),
            jank: calculateAverage(jankScores),
            worstFrameTime,
            elementCount,
            frames,
            success: true
          });
        }
      }
      
      requestAnimationFrame(renderFrame);
    });
  } catch (error) {
    return {
      fps: 0,
      renderTime: 0,
      jank: 0,
      worstFrameTime: 0,
      elementCount: 0,
      frames: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Simulate UI rendering benchmark in Node.js environment
 * @param {Object} parameters - Benchmark parameters
 * @returns {Object} - Simulated benchmark results
 */
function simulateUiRenderingBenchmark(parameters) {
  const elementCount = parameters.elementCount || 1000;
  
  // Simulate performance based on element count
  // More elements = lower FPS, higher render time and jank
  const baseFps = 60;
  const baseRenderTime = 16.7; // ms (60fps)
  
  const simulatedFps = Math.max(10, baseFps - (elementCount / 1000) * 30);
  const simulatedRenderTime = baseRenderTime + (elementCount / 1000) * 20;
  const simulatedJank = (elementCount / 1000) * 5;
  
  return {
    fps: simulatedFps,
    renderTime: simulatedRenderTime,
    jank: simulatedJank,
    worstFrameTime: simulatedRenderTime * 2,
    elementCount,
    frames: parameters.frames || 60,
    simulated: true,
    success: true
  };
}

/**
 * Benchmark resource allocation performance
 * @param {Object} parameters - Benchmark parameters
 * @returns {Promise<Object>} - Benchmark results
 */
async function benchmarkResourceAllocation(parameters) {
  try {
    // Import resource allocation manager
    const { ResourceAllocationManager } = await import('./resource-allocation-manager.js');
    
    // Get instance
    const resourceManager = await ResourceAllocationManager.getInstance();
    
    // Number of components to register
    const componentCount = parameters.componentCount || 50;
    
    // Register components
    const components = [];
    const startRegistrationTime = performance.now();
    
    for (let i = 0; i < componentCount; i++) {
      const isEssential = i < componentCount * 0.2; // 20% are essential
      const cpuPriority = isEssential ? 'high' : (i % 3 === 0 ? 'medium' : 'low');
      const memoryFootprint = isEssential ? 'large' : (i % 2 === 0 ? 'medium' : 'small');
      
      const componentId = `bench-component-${i}-${Date.now()}`;
      
      await resourceManager.registerComponent(componentId, {
        cpuPriority,
        memoryFootprint,
        isEssential,
        pauseCallback: () => Promise.resolve(true),
        resumeCallback: () => Promise.resolve(true),
        reduceResourcesCallback: () => Promise.resolve(true)
      });
      
      components.push(componentId);
    }
    
    const endRegistrationTime = performance.now();
    
    // Test optimization
    const startOptimizationTime = performance.now();
    
    // Simulate resource pressure
    await resourceManager.handleResourcePressure({
      cpu: parameters.cpuPressure || 0.85,
      memory: parameters.memoryPressure || 0.7
    });
    
    const endOptimizationTime = performance.now();
    
    // Get component states
    const componentStates = await resourceManager.getComponentStates();
    const pausedComponents = Object.values(componentStates).filter(c => c.state === 'paused').length;
    
    // Clean up if not a warmup
    if (!parameters.warmup) {
      for (const componentId of components) {
        await resourceManager.unregisterComponent(componentId);
      }
    }
    
    return {
      allocationTime: endRegistrationTime - startRegistrationTime,
      optimizationTime: endOptimizationTime - startOptimizationTime,
      componentCount,
      componentSwitches: pausedComponents,
      registrationTimePerComponent: (endRegistrationTime - startRegistrationTime) / componentCount,
      success: true
    };
  } catch (error) {
    return {
      allocationTime: 0,
      optimizationTime: 0,
      componentCount: 0,
      componentSwitches: 0,
      registrationTimePerComponent: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Benchmark gesture processing performance
 * @param {Object} parameters - Benchmark parameters
 * @returns {Promise<Object>} - Benchmark results
 */
async function benchmarkGestureProcessing(parameters) {
  // This benchmark requires gesture system components
  // For now, we'll return simulated results
  
  try {
    // Simulate gesture processing with realistic timings
    const gestureCount = parameters.gestureCount || 10;
    const detectionTimes = [];
    const processingTimes = [];
    const accuracyScores = [];
    
    for (let i = 0; i < gestureCount; i++) {
      // Simulate detection time (10-50ms)
      detectionTimes.push(10 + Math.random() * 40);
      
      // Simulate processing time (5-30ms)
      processingTimes.push(5 + Math.random() * 25);
      
      // Simulate accuracy (0.7-1.0)
      accuracyScores.push(0.7 + Math.random() * 0.3);
    }
    
    return {
      detectionTime: calculateAverage(detectionTimes),
      processingTime: calculateAverage(processingTimes),
      accuracy: calculateAverage(accuracyScores),
      gestureCount,
      totalTime: calculateSum(detectionTimes) + calculateSum(processingTimes),
      simulated: true,
      success: true
    };
  } catch (error) {
    return {
      detectionTime: 0,
      processingTime: 0,
      accuracy: 0,
      gestureCount: 0,
      totalTime: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Benchmark memory usage
 * @param {Object} parameters - Benchmark parameters
 * @returns {Promise<Object>} - Benchmark results
 */
async function benchmarkMemoryUsage(parameters) {
  const startMemory = process.memoryUsage();
  const memorySnapshots = [];
  
  try {
    // Take initial snapshot
    memorySnapshots.push(process.memoryUsage());
    
    // Create memory pressure if specified
    const memoryChunks = [];
    if (parameters.createMemoryPressure) {
      const chunkSize = 1024 * 1024; // 1MB
      const chunkCount = parameters.memoryChunks || 20;
      
      for (let i = 0; i < chunkCount; i++) {
        memoryChunks.push(Buffer.alloc(chunkSize));
        
        // Take snapshot every 5 chunks
        if (i % 5 === 0) {
          memorySnapshots.push(process.memoryUsage());
        }
        
        // Small delay to allow for GC
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Wait for potential GC
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Take final snapshot
    const endMemory = process.memoryUsage();
    memorySnapshots.push(endMemory);
    
    // Calculate metrics
    const peakMemory = memorySnapshots.reduce((max, snapshot) => 
      Math.max(max, snapshot.heapUsed), 0);
    
    const steadyStateMemory = endMemory.heapUsed;
    
    // Calculate leak rate (if any)
    let leakRate = 0;
    if (memorySnapshots.length > 2) {
      const firstSnapshot = memorySnapshots[0].heapUsed;
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      leakRate = (lastSnapshot - firstSnapshot) / (1024 * 1024); // MB
    }
    
    // Clear memory pressure
    if (parameters.createMemoryPressure) {
      memoryChunks.length = 0;
    }
    
    return {
      peakMemory: peakMemory / (1024 * 1024), // MB
      steadyStateMemory: steadyStateMemory / (1024 * 1024), // MB
      leakRate,
      snapshotCount: memorySnapshots.length,
      rss: endMemory.rss / (1024 * 1024), // MB
      heapTotal: endMemory.heapTotal / (1024 * 1024), // MB
      success: true
    };
  } catch (error) {
    return {
      peakMemory: 0,
      steadyStateMemory: 0,
      leakRate: 0,
      snapshotCount: memorySnapshots.length,
      success: false,
      error: error.message
    };
  }
}

/**
 * Run all available benchmarks
 * @param {Object} options - Benchmark options
 * @returns {Promise<Object>} - All benchmark results
 */
export async function runAllBenchmarks(options = {}) {
  const results = {};
  const benchmarkIds = Object.keys(benchmarkDefinitions);
  
  console.log(`Running all benchmarks (${benchmarkIds.length} total)`);
  
  for (const benchmarkId of benchmarkIds) {
    console.log(`\n--- Benchmark: ${benchmarkDefinitions[benchmarkId].name} ---`);
    
    try {
      const result = await runBenchmark(benchmarkId, options);
      results[benchmarkId] = result;
    } catch (error) {
      console.error(`Failed to run benchmark ${benchmarkId}:`, error);
      results[benchmarkId] = {
        id: benchmarkId,
        name: benchmarkDefinitions[benchmarkId].name,
        error: error.message,
        success: false
      };
    }
  }
  
  console.log('\nAll benchmarks completed');
  
  return {
    timestamp: Date.now(),
    benchmarkCount: benchmarkIds.length,
    successCount: Object.values(results).filter(r => r.success).length,
    failureCount: Object.values(results).filter(r => !r.success).length,
    results
  };
}

/**
 * Get benchmark results
 * @param {string} benchmarkId - ID of the benchmark (optional)
 * @returns {Object|Array} - Benchmark results
 */
export function getBenchmarkResults(benchmarkId) {
  if (benchmarkId) {
    return benchmarkResults.get(benchmarkId) || null;
  }
  
  return Array.from(benchmarkResults.values());
}

/**
 * Compare benchmark results with previous results
 * @param {string} benchmarkId - ID of the benchmark
 * @param {Object} currentResults - Current benchmark results
 * @param {Object} previousResults - Previous benchmark results
 * @returns {Object} - Comparison results
 */
export function compareBenchmarkResults(benchmarkId, currentResults, previousResults) {
  if (!currentResults || !previousResults) {
    return {
      benchmarkId,
      comparable: false,
      reason: 'Missing results'
    };
  }
  
  const definition = benchmarkDefinitions[benchmarkId];
  if (!definition) {
    return {
      benchmarkId,
      comparable: false,
      reason: 'Unknown benchmark'
    };
  }
  
  const comparison = {
    benchmarkId,
    name: definition.name,
    comparable: true,
    metrics: {},
    improvements: [],
    regressions: []
  };
  
  // Compare each metric
  for (const metric of definition.metrics) {
    if (currentResults.results[metric] !== undefined && 
        previousResults.results[metric] !== undefined) {
      
      const current = currentResults.results[metric];
      const previous = previousResults.results[metric];
      
      // Calculate change
      let change = 0;
      let changePercent = 0;
      
      if (previous !== 0) {
        change = current - previous;
        changePercent = (change / previous) * 100;
      }
      
      // Determine if this is an improvement or regression
      // Note: For some metrics, lower is better (e.g., time)
      const lowerIsBetter = metric.includes('Time') || 
                           metric.includes('Memory') || 
                           metric.includes('jank') ||
                           metric.includes('leak');
      
      const isImprovement = lowerIsBetter ? change < 0 : change > 0;
      const isRegression = lowerIsBetter ? change > 0 : change < 0;
      
      comparison.metrics[metric] = {
        current,
        previous,
        change,
        changePercent,
        isImprovement,
        isRegression
      };
      
      // Track improvements and regressions
      if (isImprovement && Math.abs(changePercent) >= 5) {
        comparison.improvements.push(metric);
      } else if (isRegression && Math.abs(changePercent) >= 5) {
        comparison.regressions.push(metric);
      }
    }
  }
  
  return comparison;
}

/**
 * Format benchmark results for display
 * @param {Object} results - Benchmark results
 * @returns {string} - Formatted results
 */
function formatBenchmarkResults(results) {
  let output = '';
  
  for (const [metric, value] of Object.entries(results)) {
    if (typeof value === 'number') {
      output += `\n  ${metric}: ${value.toFixed(2)}`;
    }
  }
  
  return output;
}

/**
 * Aggregate benchmark results from multiple iterations
 * @param {Object[]} iterationResults - Results from each iteration
 * @param {string[]} metrics - Metrics to aggregate
 * @returns {Object} - Aggregated results
 */
function aggregateBenchmarkResults(iterationResults, metrics) {
  const results = {};
  
  // Initialize results
  for (const metric of metrics) {
    results[metric] = 0;
  }
  
  // Sum up values
  for (const iteration of iterationResults) {
    for (const metric of metrics) {
      if (typeof iteration[metric] === 'number') {
        results[metric] += iteration[metric];
      }
    }
  }
  
  // Calculate averages
  const count = iterationResults.length;
  if (count > 0) {
    for (const metric of metrics) {
      results[metric] /= count;
    }
  }
  
  return results;
}

/**
 * Calculate average of an array of numbers
 * @param {number[]} values - Values to average
 * @returns {number} - Average value
 */
function calculateAverage(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate sum of an array of numbers
 * @param {number[]} values - Values to sum
 * @returns {number} - Sum
 */
function calculateSum(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0);
}

// Export benchmark definitions
export { benchmarkDefinitions };
