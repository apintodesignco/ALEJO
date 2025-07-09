# ALEJO Performance Management System

This guide provides comprehensive documentation for ALEJO's performance management system, including the resource allocation manager, performance logger, resource monitoring dashboard, and performance benchmarking tools.

## Table of Contents

1. [Overview](#overview)
2. [Components](#components)
3. [Resource Allocation Manager](#resource-allocation-manager)
4. [Performance Logger](#performance-logger)
5. [Resource Monitoring Dashboard](#resource-monitoring-dashboard)
6. [Performance Integration](#performance-integration)
7. [Performance Benchmarking](#performance-benchmarking)
8. [Performance Testing](#performance-testing)
9. [Performance Monitoring CLI](#performance-monitoring-cli)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

## Overview

The ALEJO Performance Management System is designed to optimize resource usage, monitor system performance, and provide tools for benchmarking and testing. It ensures that ALEJO runs efficiently across different hardware configurations while prioritizing essential components, especially those related to accessibility.

### Key Features

- **Resource Allocation**: Intelligent allocation of CPU and memory resources based on component priorities
- **Performance Monitoring**: Real-time monitoring of system-wide and component-level resource usage
- **Resource Optimization**: Automatic adjustment of resource usage based on system load
- **Performance Logging**: Comprehensive logging of performance events and metrics
- **Benchmarking**: Standardized benchmarks for measuring performance across environments
- **Testing**: Tools for performance testing and regression detection
- **Visualization**: Dashboard for visualizing resource usage and performance metrics
- **CLI Monitoring**: Command-line tool for monitoring performance in headless environments

## Components

The performance management system consists of the following components:

1. **Resource Allocation Manager** (`src/performance/resource-allocation-manager.js`)
   - Core component responsible for managing resource allocation
   - Registers components with resource requirements
   - Handles resource pressure by pausing/resuming components
   - Provides resource usage information

2. **Performance Logger** (`src/performance/performance-logger.js`)
   - Logs performance events and metrics
   - Tracks resource usage over time
   - Provides benchmarking capabilities
   - Generates performance reports

3. **Resource Monitoring Dashboard** (`src/performance/resource-monitoring-dashboard.js`)
   - Visual dashboard for monitoring resource usage
   - Real-time CPU and memory usage gauges
   - Component-level resource breakdown
   - User-configurable thresholds and modes

4. **Performance Integration** (`src/performance/performance-integration.js`)
   - Integrates all performance components
   - Provides a unified interface for performance management
   - Handles event subscriptions and publishing

5. **Performance Benchmarking** (`src/performance/performance-benchmarking.js`)
   - Standardized benchmarks for measuring performance
   - Component-specific and system-wide benchmarks
   - Comparison with baseline results

6. **Performance Test Utility** (`scripts/performance-test-utility.js`)
   - Automated performance testing
   - Regression detection
   - Test result reporting

7. **Performance Monitor CLI** (`scripts/performance-monitor-cli.js`)
   - Command-line tool for monitoring performance
   - Real-time resource usage visualization
   - Component-level monitoring

## Resource Allocation Manager

The Resource Allocation Manager is the core component responsible for managing CPU and memory resources across ALEJO's components.

### Key Concepts

- **Component Registration**: Components register with the manager, specifying their resource requirements
- **Resource Priorities**: Components are assigned CPU and memory priorities
- **Essential Components**: Critical components that should never be paused
- **Resource Modes**: Different resource usage modes (performance, balanced, efficiency)
- **Resource Pressure Handling**: Automatic handling of high CPU or memory usage

### Usage

```javascript
import { ResourceAllocationManager } from '../performance/resource-allocation-manager.js';

// Get the singleton instance
const resourceManager = await ResourceAllocationManager.getInstance();

// Register a component
await resourceManager.registerComponent('my-component', {
  cpuPriority: 'medium',      // 'high', 'medium', or 'low'
  memoryFootprint: 'small',   // 'large', 'medium', or 'small'
  isEssential: false,         // Whether this component is essential
  pauseCallback: async () => {
    // Code to pause the component
    return true;
  },
  resumeCallback: async () => {
    // Code to resume the component
    return true;
  },
  reduceResourcesCallback: async () => {
    // Code to reduce resource usage
    return true;
  }
});

// Unregister a component
await resourceManager.unregisterComponent('my-component');

// Get current resource usage
const usage = await resourceManager.getCurrentResourceUsage();
console.log(`CPU: ${usage.cpu}%, Memory: ${usage.memory}%`);

// Set resource mode
await resourceManager.setResourceMode('efficiency'); // 'performance', 'balanced', or 'efficiency'

// Manually pause/resume components
await resourceManager.pauseComponent('my-component');
await resourceManager.resumeComponent('my-component');

// Get component states
const states = await resourceManager.getComponentStates();
```

### Integration Pattern

Each module should follow the consistent pattern for integrating with the Resource Allocation Manager:

1. Create a performance-integration.js file in your module
2. Define component IDs specific to your module
3. Track registration status
4. Implement registerWithResourceManager and unregisterFromResourceManager functions
5. Handle resource mode changes with specific adaptations for your module

See the [Performance Integration](#performance-integration) section for more details.

## Performance Logger

The Performance Logger provides comprehensive logging of performance events, metrics, and resource usage.

### Key Features

- **Event Logging**: Log performance-related events with timestamps and context
- **Metric Recording**: Track performance metrics over time
- **Resource Usage Tracking**: Monitor CPU and memory usage
- **Benchmarking**: Start, measure, and end performance benchmarks
- **Report Generation**: Generate comprehensive performance reports

### Usage

```javascript
import {
  initializePerformanceLogger,
  logPerformanceEvent,
  recordMetric,
  startBenchmark,
  recordBenchmarkMeasurement,
  endBenchmark,
  generatePerformanceReport
} from '../performance/performance-logger.js';

// Initialize the logger
await initializePerformanceLogger();

// Log a performance event
logPerformanceEvent('component-initialized', {
  componentId: 'my-component',
  duration: 150 // ms
});

// Record a performance metric
recordMetric('response-time', 45.2, {
  componentId: 'my-component',
  operation: 'process-input'
});

// Run a benchmark
startBenchmark('my-benchmark', {
  componentId: 'my-component'
});

// Record intermediate measurements
recordBenchmarkMeasurement('my-benchmark', 'step-1-complete');
recordBenchmarkMeasurement('my-benchmark', 'step-2-complete');

// End the benchmark
const results = endBenchmark('my-benchmark');

// Generate a performance report
const report = generatePerformanceReport({
  timeRange: 3600000, // Last hour
  includeResourceUsage: true,
  includeEvents: true,
  includeBenchmarks: true
});
```

### Metric Definitions

The Performance Logger includes predefined metrics for common performance measurements:

- **initialization-time**: Time taken to initialize components (ms)
- **cpu-usage**: Percentage of CPU used by the application (%)
- **memory-usage**: Memory used by the application (MB)
- **response-time**: Time taken to respond to user input (ms)
- **frame-rate**: Frames per second for UI rendering (fps)

You can also define custom metrics as needed.

## Resource Monitoring Dashboard

The Resource Monitoring Dashboard provides a visual interface for monitoring resource usage in real-time.

### Key Features

- **Real-time CPU and Memory Gauges**: Visual representation of current resource usage
- **Resource Usage History**: Charts showing resource usage over time
- **Component-level Breakdown**: Detailed view of resource usage by component
- **Resource Mode Controls**: Switch between performance, balanced, and efficiency modes
- **User-configurable Thresholds**: Set custom warning and critical thresholds
- **Accessibility Features**: Keyboard navigation and ARIA support

### Usage

```javascript
import {
  initializeResourceDashboard,
  showDashboard,
  hideDashboard,
  toggleDashboard,
  updateThresholds
} from '../performance/resource-monitoring-dashboard.js';

// Initialize the dashboard
await initializeResourceDashboard();

// Show the dashboard
showDashboard();

// Hide the dashboard
hideDashboard();

// Toggle dashboard visibility
toggleDashboard();

// Update thresholds
updateThresholds({
  cpu: {
    warning: 70,
    critical: 90
  },
  memory: {
    warning: 70,
    critical: 90
  }
});
```

### Keyboard Shortcuts

The dashboard supports the following keyboard shortcuts:

- **Esc**: Close the dashboard
- **Tab**: Navigate between controls
- **Space/Enter**: Activate buttons and controls
- **Arrow Keys**: Adjust threshold sliders
- **1, 2, 3**: Switch between Performance, Balanced, and Efficiency modes

## Performance Integration

The Performance Integration module provides a unified interface for all performance-related components.

### Key Features

- **Unified Initialization**: Initialize all performance components
- **Resource Monitoring**: Automatic monitoring of resource usage
- **Event Handling**: Subscription to relevant performance events
- **Auto-reporting**: Periodic generation of performance reports
- **Resource Mode Management**: Centralized control of resource modes

### Usage

```javascript
import {
  initializePerformanceManagement,
  updateResourceMonitoringInterval,
  updateAutoReportingInterval,
  generateOnDemandReport,
  getCurrentResourceUsage,
  setResourceMode,
  pauseComponent,
  resumeComponent
} from '../performance/performance-integration.js';

// Initialize performance management
await initializePerformanceManagement({
  enableDashboard: true,
  enableAutoReporting: true,
  resourceMonitoringInterval: 5000, // ms
  autoReportInterval: 3600000 // 1 hour
});

// Update monitoring interval
updateResourceMonitoringInterval(10000); // 10 seconds

// Update auto-reporting interval
updateAutoReportingInterval(7200000); // 2 hours

// Generate an on-demand report
const report = await generateOnDemandReport({
  timeRange: 1800000, // Last 30 minutes
  includeResourceUsage: true
});

// Get current resource usage
const usage = await getCurrentResourceUsage();

// Set resource mode
await setResourceMode('efficiency');

// Pause/resume components
await pauseComponent('my-component');
await resumeComponent('my-component');
```

### Module Integration Pattern

Each module should implement a performance integration file with the following structure:

```javascript
import { ResourceAllocationManager } from '../performance/resource-allocation-manager.js';
import { publishEvent, subscribeToEvent } from '../core/neural-architecture/neural-event-bus.js';

// Component IDs
const COMPONENT_IDS = {
  MAIN: 'my-module-main',
  PROCESSOR: 'my-module-processor'
};

// Registration status
let isRegistered = false;
const registrations = new Map();
let currentResourceMode = 'balanced';

/**
 * Register module components with the resource manager
 */
export async function registerWithResourceManager() {
  if (isRegistered) return;
  
  const resourceManager = await ResourceAllocationManager.getInstance();
  
  // Register main component
  const mainRegistration = await resourceManager.registerComponent(COMPONENT_IDS.MAIN, {
    cpuPriority: 'medium',
    memoryFootprint: 'medium',
    isEssential: false,
    pauseCallback: async () => {
      // Pause logic
      return true;
    },
    resumeCallback: async () => {
      // Resume logic
      return true;
    },
    reduceResourcesCallback: async () => {
      // Resource reduction logic
      return true;
    }
  });
  
  registrations.set(COMPONENT_IDS.MAIN, mainRegistration);
  
  // Register processor component
  // ...
  
  // Subscribe to resource mode changes
  subscribeToEvent('resource-manager:mode-changed', handleResourceModeChanged);
  
  isRegistered = true;
}

/**
 * Unregister module components from the resource manager
 */
export async function unregisterFromResourceManager() {
  if (!isRegistered) return;
  
  const resourceManager = await ResourceAllocationManager.getInstance();
  
  // Unregister all components
  for (const [componentId] of registrations) {
    await resourceManager.unregisterComponent(componentId);
  }
  
  registrations.clear();
  isRegistered = false;
}

/**
 * Handle resource mode changes
 */
function handleResourceModeChanged(data) {
  currentResourceMode = data.mode;
  
  // Adapt module behavior based on resource mode
  switch (currentResourceMode) {
    case 'performance':
      // Optimize for performance
      break;
    case 'balanced':
      // Balance performance and efficiency
      break;
    case 'efficiency':
      // Optimize for efficiency
      break;
  }
}

/**
 * Get current resource mode
 */
export function getCurrentResourceMode() {
  return currentResourceMode;
}
```

## Performance Benchmarking

The Performance Benchmarking module provides standardized benchmarks for measuring ALEJO's performance.

### Key Features

- **Standardized Benchmarks**: Consistent benchmarks for different components
- **Warmup Iterations**: Eliminate cold-start effects
- **Result Aggregation**: Statistical analysis of benchmark results
- **Comparison**: Compare results with previous benchmarks
- **Environment Awareness**: Adapt to different environments

### Available Benchmarks

- **system-startup**: Measures system initialization performance
- **ui-rendering**: Measures UI rendering performance
- **resource-allocation**: Measures resource allocation and optimization
- **gesture-processing**: Measures gesture detection and processing
- **memory-usage**: Measures memory usage patterns

### Usage

```javascript
import {
  runBenchmark,
  runAllBenchmarks,
  getBenchmarkResults,
  compareBenchmarkResults,
  benchmarkDefinitions
} from '../performance/performance-benchmarking.js';

// Run a specific benchmark
const results = await runBenchmark('system-startup', {
  iterations: 5,
  warmupIterations: 2,
  parameters: {
    prioritizeAccessibility: true
  }
});

// Run all benchmarks
const allResults = await runAllBenchmarks({
  iterations: 3,
  warmupIterations: 1
});

// Get previous benchmark results
const previousResults = getBenchmarkResults('system-startup');

// Compare results
const comparison = compareBenchmarkResults(
  'system-startup',
  results,
  previousResults
);

// List available benchmarks
console.log('Available benchmarks:');
Object.entries(benchmarkDefinitions).forEach(([id, def]) => {
  console.log(`- ${id}: ${def.name} - ${def.description}`);
});
```

## Performance Testing

The Performance Test Utility provides tools for automated performance testing and regression detection.

### Key Features

- **Automated Testing**: Run performance tests with minimal setup
- **Test Scenarios**: Predefined test scenarios for different components
- **Regression Detection**: Automatically detect performance regressions
- **Baseline Comparison**: Compare results with baseline measurements
- **Report Generation**: Generate detailed test reports

### Available Test Scenarios

- **system-initialization**: Test system initialization performance
- **resource-allocation**: Test resource allocation manager performance
- **ui-responsiveness**: Test UI responsiveness under load
- **memory-management**: Test memory management and garbage collection

### Usage

```javascript
const { runPerformanceTests, testScenarios, config } = require('../scripts/performance-test-utility.js');

// Run all performance tests
const results = await runPerformanceTests({
  testIterations: 5,
  warmupIterations: 2,
  regressionThreshold: 0.1, // 10%
  reportFormat: 'json'
});

// List available test scenarios
console.log('Available test scenarios:');
testScenarios.forEach(scenario => {
  console.log(`- ${scenario.name}: ${scenario.description}`);
});

// Customize configuration
config.testIterations = 10;
config.cpuLoadLevels = [0.3, 0.6, 0.9];
```

### Integration with CI/CD

The Performance Test Utility is designed to integrate with CI/CD pipelines:

```yaml
# GitHub Actions workflow example
performance-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - name: Run performance tests
      run: node scripts/performance-test-utility.js
    - name: Upload test results
      uses: actions/upload-artifact@v3
      with:
        name: performance-test-results
        path: test-results/performance
```

## Performance Monitoring CLI

The Performance Monitor CLI provides a command-line tool for monitoring ALEJO's performance in real-time.

### Key Features

- **Real-time Monitoring**: Monitor CPU and memory usage in real-time
- **Component Breakdown**: View resource usage by component
- **History Tracking**: Track resource usage over time
- **Threshold Alerts**: Visual alerts for high resource usage
- **Logging**: Save metrics to log files for later analysis

### Usage

```bash
# Basic usage
node scripts/performance-monitor-cli.js

# Set update interval
node scripts/performance-monitor-cli.js --interval 5000

# Filter by component
node scripts/performance-monitor-cli.js --component gesture

# Specify log file
node scripts/performance-monitor-cli.js --log ./logs/custom-performance.log

# Hide component details
node scripts/performance-monitor-cli.js --no-details

# Show help
node scripts/performance-monitor-cli.js --help
```

### Keyboard Controls

- **q**: Quit
- **c**: Toggle component details
- **s**: Save current metrics to log file
- **r**: Reset statistics
- **h**: Show help

## Best Practices

### Resource Allocation

1. **Register Early**: Register components with the Resource Allocation Manager as early as possible
2. **Accurate Priorities**: Set accurate CPU and memory priorities for your components
3. **Essential Components**: Only mark components as essential if they are truly critical
4. **Efficient Callbacks**: Implement efficient pause/resume callbacks
5. **Resource Reduction**: Implement resource reduction callbacks for gradual resource management

### Performance Logging

1. **Selective Logging**: Log important events but avoid excessive logging
2. **Meaningful Metrics**: Record metrics that provide actionable insights
3. **Benchmark Carefully**: Use benchmarks with appropriate warmup iterations
4. **Regular Reports**: Generate periodic performance reports

### Dashboard Usage

1. **Appropriate Thresholds**: Set appropriate warning and critical thresholds
2. **Resource Mode Selection**: Choose the appropriate resource mode for your use case
3. **Accessibility**: Ensure the dashboard is accessible to all users

### Testing and Benchmarking

1. **Consistent Environment**: Run tests in a consistent environment
2. **Baseline Maintenance**: Regularly update baseline measurements
3. **Regression Monitoring**: Monitor for performance regressions
4. **CI Integration**: Integrate performance tests into your CI pipeline

## Troubleshooting

### High CPU Usage

1. **Check Component States**: Use `resourceManager.getComponentStates()` to see which components are active
2. **Review Resource Mode**: Ensure the appropriate resource mode is selected
3. **Inspect Event Logs**: Check performance logs for excessive events
4. **Benchmark Specific Components**: Run targeted benchmarks to identify problematic components

### High Memory Usage

1. **Monitor Memory Trends**: Use the dashboard to monitor memory usage over time
2. **Check for Leaks**: Run memory usage benchmarks to detect leaks
3. **Inspect Component Memory**: Review component-specific memory usage
4. **Force Garbage Collection**: If available, try forcing garbage collection

### Performance Regressions

1. **Compare with Baseline**: Run performance tests and compare with baseline
2. **Isolate Components**: Test individual components to identify the source
3. **Review Recent Changes**: Check recent code changes that might affect performance
4. **Adjust Thresholds**: Update resource thresholds if hardware capabilities have changed

### Dashboard Issues

1. **Check Initialization**: Ensure the dashboard is properly initialized
2. **Inspect Console Errors**: Check for JavaScript errors in the console
3. **Verify DOM Elements**: Ensure dashboard elements are properly created
4. **Test Event Subscriptions**: Verify that events are properly subscribed

### CLI Monitoring Issues

1. **Check Terminal Capabilities**: Ensure your terminal supports the required features
2. **Adjust Update Interval**: Try increasing the update interval
3. **Reduce Data Volume**: Use the `--no-details` flag to reduce output
4. **Check Log File Permissions**: Ensure the log file is writable
