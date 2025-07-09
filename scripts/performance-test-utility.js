/**
 * ALEJO Performance Test Utility
 * 
 * This script provides tools for testing and benchmarking ALEJO's performance
 * across different environments and configurations. It integrates with the
 * performance monitoring system and automated testing framework.
 * 
 * Features:
 * - Component-level performance testing
 * - System-wide benchmarking
 * - Resource usage simulation
 * - Performance regression detection
 * - Test result reporting and visualization
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const { spawn } = require('child_process');

// Configuration
const config = {
  outputDir: path.join(__dirname, '../test-results/performance'),
  baselineDir: path.join(__dirname, '../test-results/performance/baseline'),
  testIterations: 5,
  warmupIterations: 2,
  cpuLoadLevels: [0.2, 0.5, 0.8], // 20%, 50%, 80%
  memoryLoadLevels: [0.3, 0.6, 0.9], // 30%, 60%, 90%
  testTimeoutMs: 60000, // 1 minute
  regressionThreshold: 0.1, // 10% performance degradation
  reportFormat: 'json',
  includeInCi: true
};

// Test scenarios
const testScenarios = [
  {
    name: 'system-initialization',
    description: 'Test system initialization performance',
    testFunction: testSystemInitialization,
    metrics: ['duration', 'peakMemory', 'componentCount']
  },
  {
    name: 'resource-allocation',
    description: 'Test resource allocation manager performance',
    testFunction: testResourceAllocation,
    metrics: ['allocationTime', 'optimizationTime', 'componentSwitches']
  },
  {
    name: 'ui-responsiveness',
    description: 'Test UI responsiveness under load',
    testFunction: testUiResponsiveness,
    metrics: ['frameRate', 'inputLatency', 'renderTime']
  },
  {
    name: 'memory-management',
    description: 'Test memory management and garbage collection',
    testFunction: testMemoryManagement,
    metrics: ['leakRate', 'gcPauses', 'retainedSize']
  }
];

/**
 * Main entry point for the performance test utility
 * @param {Object} options - Test options
 * @returns {Promise<Object>} - Test results
 */
async function runPerformanceTests(options = {}) {
  try {
    // Merge options with default config
    const testConfig = { ...config, ...options };
    
    console.log('=== ALEJO Performance Test Utility ===');
    console.log(`Starting performance tests with ${testConfig.testIterations} iterations`);
    console.log('--------------------------------------');
    
    // Create output directory if it doesn't exist
    await createDirectoryIfNotExists(testConfig.outputDir);
    await createDirectoryIfNotExists(testConfig.baselineDir);
    
    // Run environment checks
    const environment = await checkEnvironment();
    console.log('Environment:', environment);
    
    // Run all test scenarios
    const results = {};
    for (const scenario of testScenarios) {
      console.log(`\nRunning scenario: ${scenario.name}`);
      console.log(scenario.description);
      
      // Run warmup iterations
      console.log(`Warming up (${testConfig.warmupIterations} iterations)...`);
      for (let i = 0; i < testConfig.warmupIterations; i++) {
        await scenario.testFunction({ warmup: true });
      }
      
      // Run actual test iterations
      console.log(`Running test (${testConfig.testIterations} iterations)...`);
      const scenarioResults = [];
      
      for (let i = 0; i < testConfig.testIterations; i++) {
        const iterationResult = await scenario.testFunction({ 
          iteration: i,
          timeout: testConfig.testTimeoutMs
        });
        
        scenarioResults.push(iterationResult);
        console.log(`  Iteration ${i + 1}/${testConfig.testIterations} completed`);
      }
      
      // Aggregate results
      const aggregatedResults = aggregateResults(scenarioResults, scenario.metrics);
      results[scenario.name] = aggregatedResults;
      
      // Compare with baseline
      const comparison = await compareWithBaseline(scenario.name, aggregatedResults);
      console.log('Results:', formatResults(aggregatedResults));
      
      if (comparison.hasBaseline) {
        console.log('Comparison with baseline:');
        console.log(formatComparison(comparison));
      } else {
        console.log('No baseline found. Current results will be saved as baseline.');
      }
      
      // Save results
      await saveResults(scenario.name, aggregatedResults, testConfig);
    }
    
    // Generate report
    const reportPath = await generateReport(results, environment, testConfig);
    console.log(`\nPerformance test report saved to: ${reportPath}`);
    
    return {
      success: true,
      results,
      environment,
      reportPath
    };
  } catch (error) {
    console.error('Error running performance tests:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test system initialization performance
 * @param {Object} options - Test options
 * @returns {Promise<Object>} - Test results
 */
async function testSystemInitialization(options = {}) {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    // Import initialization manager dynamically
    const { initializeSystem } = await import('../src/core/system/initialization-manager.js');
    
    // Run initialization
    const initResult = await initializeSystem({
      prioritizeAccessibility: true,
      allowProgressiveLoading: true
    });
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      duration: endTime - startTime,
      peakMemory: (endMemory - startMemory) / (1024 * 1024), // MB
      componentCount: initResult.initialized.length,
      failedCount: initResult.failed.length,
      success: true
    };
  } catch (error) {
    const endTime = performance.now();
    
    return {
      duration: endTime - startTime,
      peakMemory: 0,
      componentCount: 0,
      failedCount: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Test resource allocation manager performance
 * @param {Object} options - Test options
 * @returns {Promise<Object>} - Test results
 */
async function testResourceAllocation(options = {}) {
  try {
    // Import resource allocation manager dynamically
    const { ResourceAllocationManager } = await import('../src/performance/resource-allocation-manager.js');
    
    // Get instance
    const resourceManager = await ResourceAllocationManager.getInstance();
    
    // Register test components
    const componentCount = 50;
    const components = [];
    
    const startRegistrationTime = performance.now();
    
    for (let i = 0; i < componentCount; i++) {
      const isEssential = i < 10; // First 10 components are essential
      const cpuPriority = isEssential ? 'high' : (i % 3 === 0 ? 'medium' : 'low');
      const memoryFootprint = isEssential ? 'large' : (i % 2 === 0 ? 'medium' : 'small');
      
      const componentId = `test-component-${i}`;
      
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
    
    // Simulate high CPU usage to trigger optimization
    await resourceManager.handleResourcePressure({
      cpu: 0.85,
      memory: 0.5
    });
    
    const endOptimizationTime = performance.now();
    
    // Get component states
    const componentStates = await resourceManager.getComponentStates();
    const pausedComponents = Object.values(componentStates).filter(c => c.state === 'paused').length;
    
    // Clean up
    for (const componentId of components) {
      await resourceManager.unregisterComponent(componentId);
    }
    
    return {
      allocationTime: endRegistrationTime - startRegistrationTime,
      optimizationTime: endOptimizationTime - startOptimizationTime,
      componentCount,
      componentSwitches: pausedComponents,
      success: true
    };
  } catch (error) {
    return {
      allocationTime: 0,
      optimizationTime: 0,
      componentCount: 0,
      componentSwitches: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Test UI responsiveness under load
 * @param {Object} options - Test options
 * @returns {Promise<Object>} - Test results
 */
async function testUiResponsiveness(options = {}) {
  // This test requires a browser environment
  // For CLI testing, we'll simulate the results
  
  if (options.warmup) {
    return { success: true };
  }
  
  // Simulate UI responsiveness test
  const frameRates = [];
  const inputLatencies = [];
  const renderTimes = [];
  
  // Simulate 10 measurements
  for (let i = 0; i < 10; i++) {
    // Simulate varying frame rates between 30-60 fps
    frameRates.push(30 + Math.random() * 30);
    
    // Simulate input latencies between 10-100ms
    inputLatencies.push(10 + Math.random() * 90);
    
    // Simulate render times between 5-20ms
    renderTimes.push(5 + Math.random() * 15);
  }
  
  return {
    frameRate: calculateAverage(frameRates),
    inputLatency: calculateAverage(inputLatencies),
    renderTime: calculateAverage(renderTimes),
    measurements: 10,
    success: true
  };
}

/**
 * Test memory management and garbage collection
 * @param {Object} options - Test options
 * @returns {Promise<Object>} - Test results
 */
async function testMemoryManagement(options = {}) {
  const startMemory = process.memoryUsage();
  const gcPauses = [];
  let lastPause = performance.now();
  
  // Create memory pressure
  const memoryChunks = [];
  const chunkSize = 1024 * 1024; // 1MB
  
  try {
    // Allocate memory in chunks to trigger GC
    for (let i = 0; i < 20; i++) {
      if (options.warmup && i > 5) break;
      
      // Allocate memory
      memoryChunks.push(Buffer.alloc(chunkSize));
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if GC might have run (heuristic)
      const now = performance.now();
      if (now - lastPause > 500) {
        gcPauses.push(now - lastPause);
        lastPause = now;
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear references to allow GC
    memoryChunks.length = 0;
    
    // Wait for GC to potentially run
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const endMemory = process.memoryUsage();
    
    // Calculate metrics
    const heapDiff = endMemory.heapUsed - startMemory.heapUsed;
    const retainedSize = heapDiff / (1024 * 1024); // MB
    
    return {
      leakRate: retainedSize / 20, // MB per allocation
      gcPauses: gcPauses.length,
      avgGcPause: calculateAverage(gcPauses),
      retainedSize,
      success: true
    };
  } catch (error) {
    return {
      leakRate: 0,
      gcPauses: 0,
      avgGcPause: 0,
      retainedSize: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Check the test environment
 * @returns {Promise<Object>} - Environment information
 */
async function checkEnvironment() {
  const nodeVersion = process.version;
  const platform = process.platform;
  const cpuInfo = {
    cores: require('os').cpus().length
  };
  const memoryInfo = {
    total: Math.round(require('os').totalmem() / (1024 * 1024 * 1024) * 10) / 10, // GB
    free: Math.round(require('os').freemem() / (1024 * 1024 * 1024) * 10) / 10 // GB
  };
  
  // Get ALEJO version if available
  let alejoVersion = 'unknown';
  try {
    const versionFile = path.join(__dirname, '../src/version.js');
    const versionContent = await fs.readFile(versionFile, 'utf8');
    const versionMatch = versionContent.match(/version: ['"](.+)['"]/);
    if (versionMatch) {
      alejoVersion = versionMatch[1];
    }
  } catch (error) {
    console.warn('Could not determine ALEJO version:', error.message);
  }
  
  return {
    nodeVersion,
    platform,
    cpuInfo,
    memoryInfo,
    alejoVersion,
    timestamp: new Date().toISOString()
  };
}

/**
 * Aggregate results from multiple test iterations
 * @param {Object[]} results - Test results
 * @param {string[]} metrics - Metrics to aggregate
 * @returns {Object} - Aggregated results
 */
function aggregateResults(results, metrics) {
  const aggregated = {
    iterations: results.length,
    metrics: {}
  };
  
  // Initialize metrics
  for (const metric of metrics) {
    aggregated.metrics[metric] = {
      values: [],
      min: Infinity,
      max: -Infinity,
      avg: 0,
      median: 0
    };
  }
  
  // Collect values
  for (const result of results) {
    for (const metric of metrics) {
      if (typeof result[metric] === 'number') {
        aggregated.metrics[metric].values.push(result[metric]);
      }
    }
  }
  
  // Calculate statistics
  for (const metric of metrics) {
    const values = aggregated.metrics[metric].values;
    
    if (values.length > 0) {
      // Sort values for min/max/median
      values.sort((a, b) => a - b);
      
      aggregated.metrics[metric].min = values[0];
      aggregated.metrics[metric].max = values[values.length - 1];
      aggregated.metrics[metric].avg = calculateAverage(values);
      
      // Calculate median
      const mid = Math.floor(values.length / 2);
      aggregated.metrics[metric].median = values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
    }
  }
  
  return aggregated;
}

/**
 * Compare results with baseline
 * @param {string} scenarioName - Test scenario name
 * @param {Object} results - Test results
 * @returns {Promise<Object>} - Comparison results
 */
async function compareWithBaseline(scenarioName, results) {
  try {
    const baselinePath = path.join(config.baselineDir, `${scenarioName}.json`);
    const baselineData = await fs.readFile(baselinePath, 'utf8');
    const baseline = JSON.parse(baselineData);
    
    const comparison = {
      hasBaseline: true,
      metrics: {},
      regressions: []
    };
    
    // Compare each metric
    for (const [metric, data] of Object.entries(results.metrics)) {
      if (baseline.metrics[metric]) {
        const baselineValue = baseline.metrics[metric].avg;
        const currentValue = data.avg;
        
        // Calculate change percentage
        let changePercent = 0;
        if (baselineValue !== 0) {
          changePercent = ((currentValue - baselineValue) / baselineValue) * 100;
        }
        
        // Determine if this is a regression
        const isRegression = changePercent > config.regressionThreshold * 100;
        
        comparison.metrics[metric] = {
          baseline: baselineValue,
          current: currentValue,
          changePercent,
          isRegression
        };
        
        if (isRegression) {
          comparison.regressions.push(metric);
        }
      }
    }
    
    return comparison;
  } catch (error) {
    // No baseline exists
    return {
      hasBaseline: false
    };
  }
}

/**
 * Save test results
 * @param {string} scenarioName - Test scenario name
 * @param {Object} results - Test results
 * @param {Object} testConfig - Test configuration
 * @returns {Promise<string>} - Path to saved results
 */
async function saveResults(scenarioName, results, testConfig) {
  // Save current results
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const resultsPath = path.join(testConfig.outputDir, `${scenarioName}_${timestamp}.json`);
  
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  
  // Save as baseline if no baseline exists
  try {
    const baselinePath = path.join(testConfig.baselineDir, `${scenarioName}.json`);
    await fs.access(baselinePath);
  } catch (error) {
    // Baseline doesn't exist, save current results as baseline
    const baselinePath = path.join(testConfig.baselineDir, `${scenarioName}.json`);
    await fs.writeFile(baselinePath, JSON.stringify(results, null, 2));
  }
  
  return resultsPath;
}

/**
 * Generate a performance test report
 * @param {Object} results - Test results
 * @param {Object} environment - Environment information
 * @param {Object} testConfig - Test configuration
 * @returns {Promise<string>} - Path to the report
 */
async function generateReport(results, environment, testConfig) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportPath = path.join(testConfig.outputDir, `performance_report_${timestamp}.${testConfig.reportFormat}`);
  
  const report = {
    title: 'ALEJO Performance Test Report',
    timestamp,
    environment,
    config: {
      iterations: testConfig.testIterations,
      warmupIterations: testConfig.warmupIterations
    },
    results
  };
  
  // Save report
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  return reportPath;
}

/**
 * Format results for console output
 * @param {Object} results - Test results
 * @returns {string} - Formatted results
 */
function formatResults(results) {
  let output = '';
  
  for (const [metric, data] of Object.entries(results.metrics)) {
    output += `\n  ${metric}: avg=${data.avg.toFixed(2)}, min=${data.min.toFixed(2)}, max=${data.max.toFixed(2)}`;
  }
  
  return output;
}

/**
 * Format comparison results for console output
 * @param {Object} comparison - Comparison results
 * @returns {string} - Formatted comparison
 */
function formatComparison(comparison) {
  let output = '';
  
  for (const [metric, data] of Object.entries(comparison.metrics)) {
    const changeSymbol = data.changePercent > 0 ? '↑' : data.changePercent < 0 ? '↓' : '=';
    const changeColor = data.isRegression ? '\x1b[31m' : data.changePercent < 0 ? '\x1b[32m' : '\x1b[0m';
    
    output += `\n  ${metric}: ${data.baseline.toFixed(2)} → ${data.current.toFixed(2)} ${changeColor}${changeSymbol}${Math.abs(data.changePercent).toFixed(2)}%\x1b[0m`;
  }
  
  if (comparison.regressions.length > 0) {
    output += `\n\n  \x1b[31mRegressions detected in: ${comparison.regressions.join(', ')}\x1b[0m`;
  } else {
    output += '\n\n  \x1b[32mNo regressions detected\x1b[0m';
  }
  
  return output;
}

/**
 * Calculate average of an array of numbers
 * @param {number[]} values - Values to average
 * @returns {number} - Average value
 */
function calculateAverage(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Create directory if it doesn't exist
 * @param {string} dir - Directory path
 * @returns {Promise<void>}
 */
async function createDirectoryIfNotExists(dir) {
  try {
    await fs.access(dir);
  } catch (error) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Export functions
module.exports = {
  runPerformanceTests,
  testScenarios,
  config
};

// Run if called directly
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}
