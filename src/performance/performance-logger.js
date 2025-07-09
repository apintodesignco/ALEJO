/**
 * ALEJO Performance Logger
 * 
 * This module provides comprehensive performance logging and analysis
 * for tracking resource usage, initialization times, and performance metrics.
 * 
 * Features:
 * - Performance event logging with timestamps and context
 * - Resource usage tracking and analysis
 * - Performance metric aggregation and reporting
 * - Integration with the resource allocation manager
 * - Support for performance benchmarking
 */

import { publishEvent } from '../core/neural-architecture/neural-event-bus.js';
import { getConfig } from '../core/config/config-manager.js';

// Performance log storage
const performanceLog = {
  events: [],
  metrics: new Map(),
  resourceUsage: [],
  benchmarks: new Map(),
  maxLogSize: 1000, // Maximum number of events to store
  isLoggingEnabled: true
};

// Performance metric definitions
const metricDefinitions = {
  'initialization-time': {
    name: 'Initialization Time',
    unit: 'ms',
    description: 'Time taken to initialize components',
    aggregation: 'average'
  },
  'cpu-usage': {
    name: 'CPU Usage',
    unit: '%',
    description: 'Percentage of CPU used by the application',
    aggregation: 'average'
  },
  'memory-usage': {
    name: 'Memory Usage',
    unit: 'MB',
    description: 'Memory used by the application in megabytes',
    aggregation: 'average'
  },
  'response-time': {
    name: 'Response Time',
    unit: 'ms',
    description: 'Time taken to respond to user input',
    aggregation: 'average'
  },
  'frame-rate': {
    name: 'Frame Rate',
    unit: 'fps',
    description: 'Frames per second for UI rendering',
    aggregation: 'average'
  }
};

/**
 * Initialize the performance logger
 * @returns {Promise<Object>} - Initialization result
 */
export async function initializePerformanceLogger() {
  try {
    console.log('Initializing Performance Logger');
    
    // Load configuration
    const config = await getConfig();
    performanceLog.isLoggingEnabled = config?.performance?.enableLogging !== false;
    performanceLog.maxLogSize = config?.performance?.maxLogSize || 1000;
    
    // Log initialization event
    logPerformanceEvent('performance-logger-initialized', {
      maxLogSize: performanceLog.maxLogSize,
      isLoggingEnabled: performanceLog.isLoggingEnabled
    });
    
    // Return success
    return {
      success: true,
      isLoggingEnabled: performanceLog.isLoggingEnabled
    };
  } catch (error) {
    console.error('Failed to initialize performance logger', error);
    throw error;
  }
}

/**
 * Log a performance event
 * @param {string} eventType - Type of performance event
 * @param {Object} data - Event data
 * @returns {Object} - Logged event
 */
export function logPerformanceEvent(eventType, data = {}) {
  if (!performanceLog.isLoggingEnabled) return null;
  
  // Create event object
  const event = {
    id: generateEventId(),
    type: eventType,
    timestamp: Date.now(),
    data: { ...data }
  };
  
  // Add to log
  performanceLog.events.push(event);
  
  // Trim log if it exceeds max size
  if (performanceLog.events.length > performanceLog.maxLogSize) {
    performanceLog.events.shift();
  }
  
  // Publish event
  publishEvent('performance:event-logged', {
    eventType,
    timestamp: event.timestamp
  });
  
  return event;
}

/**
 * Log resource usage
 * @param {Object} usage - Resource usage data
 * @param {number} usage.cpu - CPU usage percentage
 * @param {number} usage.memory - Memory usage in MB
 * @param {Map<string, Object>} usage.components - Component-specific resource usage
 * @returns {Object} - Logged usage data
 */
export function logResourceUsage(usage) {
  if (!performanceLog.isLoggingEnabled) return null;
  
  // Create usage object with timestamp
  const usageData = {
    timestamp: Date.now(),
    cpu: usage.cpu,
    memory: usage.memory,
    components: usage.components ? new Map(usage.components) : new Map()
  };
  
  // Add to log
  performanceLog.resourceUsage.push(usageData);
  
  // Trim log if it exceeds max size
  if (performanceLog.resourceUsage.length > performanceLog.maxLogSize) {
    performanceLog.resourceUsage.shift();
  }
  
  // Update metrics
  updateMetric('cpu-usage', usage.cpu);
  updateMetric('memory-usage', usage.memory);
  
  return usageData;
}

/**
 * Record a performance metric
 * @param {string} metricName - Name of the metric
 * @param {number} value - Metric value
 * @param {Object} context - Additional context
 * @returns {Object} - Updated metric
 */
export function recordMetric(metricName, value, context = {}) {
  if (!performanceLog.isLoggingEnabled) return null;
  
  // Update the metric
  return updateMetric(metricName, value, context);
}

/**
 * Start a performance benchmark
 * @param {string} benchmarkName - Name of the benchmark
 * @param {Object} metadata - Benchmark metadata
 * @returns {Object} - Benchmark start info
 */
export function startBenchmark(benchmarkName, metadata = {}) {
  if (!performanceLog.isLoggingEnabled) return null;
  
  // Create benchmark object
  const benchmark = {
    name: benchmarkName,
    startTime: performance.now(),
    metadata: { ...metadata },
    measurements: [],
    isRunning: true
  };
  
  // Store benchmark
  performanceLog.benchmarks.set(benchmarkName, benchmark);
  
  // Log event
  logPerformanceEvent('benchmark-started', {
    name: benchmarkName,
    metadata
  });
  
  return {
    name: benchmarkName,
    startTime: benchmark.startTime
  };
}

/**
 * Record an intermediate benchmark measurement
 * @param {string} benchmarkName - Name of the benchmark
 * @param {string} label - Measurement label
 * @returns {Object|null} - Measurement data or null if benchmark not found
 */
export function recordBenchmarkMeasurement(benchmarkName, label) {
  if (!performanceLog.isLoggingEnabled) return null;
  
  const benchmark = performanceLog.benchmarks.get(benchmarkName);
  if (!benchmark || !benchmark.isRunning) return null;
  
  // Create measurement
  const measurement = {
    label,
    timestamp: performance.now(),
    elapsedFromStart: performance.now() - benchmark.startTime
  };
  
  // Add to benchmark
  benchmark.measurements.push(measurement);
  
  return measurement;
}

/**
 * End a performance benchmark
 * @param {string} benchmarkName - Name of the benchmark
 * @returns {Object|null} - Benchmark results or null if benchmark not found
 */
export function endBenchmark(benchmarkName) {
  if (!performanceLog.isLoggingEnabled) return null;
  
  const benchmark = performanceLog.benchmarks.get(benchmarkName);
  if (!benchmark || !benchmark.isRunning) return null;
  
  // Update benchmark
  benchmark.endTime = performance.now();
  benchmark.duration = benchmark.endTime - benchmark.startTime;
  benchmark.isRunning = false;
  
  // Log event
  logPerformanceEvent('benchmark-ended', {
    name: benchmarkName,
    duration: benchmark.duration,
    measurementCount: benchmark.measurements.length
  });
  
  // Return results
  return {
    name: benchmarkName,
    duration: benchmark.duration,
    measurements: benchmark.measurements,
    metadata: benchmark.metadata
  };
}

/**
 * Get performance metrics for a specific time range
 * @param {Object} options - Query options
 * @param {number} options.startTime - Start timestamp
 * @param {number} options.endTime - End timestamp
 * @param {string[]} options.metricNames - Specific metrics to retrieve
 * @returns {Object} - Performance metrics
 */
export function getPerformanceMetrics(options = {}) {
  const {
    startTime = 0,
    endTime = Date.now(),
    metricNames = null
  } = options;
  
  // Filter events by time range
  const eventsInRange = performanceLog.events.filter(event => 
    event.timestamp >= startTime && event.timestamp <= endTime
  );
  
  // Filter resource usage by time range
  const resourceUsageInRange = performanceLog.resourceUsage.filter(usage => 
    usage.timestamp >= startTime && usage.timestamp <= endTime
  );
  
  // Get metrics
  let metrics;
  if (metricNames) {
    metrics = new Map();
    metricNames.forEach(name => {
      if (performanceLog.metrics.has(name)) {
        metrics.set(name, performanceLog.metrics.get(name));
      }
    });
  } else {
    metrics = new Map(performanceLog.metrics);
  }
  
  // Calculate aggregated metrics
  const aggregatedMetrics = calculateAggregatedMetrics(metrics);
  
  // Return metrics
  return {
    timeRange: {
      start: startTime,
      end: endTime
    },
    eventCount: eventsInRange.length,
    resourceSamples: resourceUsageInRange.length,
    metrics: aggregatedMetrics,
    benchmarks: Array.from(performanceLog.benchmarks.values())
      .filter(benchmark => !benchmark.isRunning)
  };
}

/**
 * Get detailed performance events for analysis
 * @param {Object} options - Query options
 * @param {number} options.startTime - Start timestamp
 * @param {number} options.endTime - End timestamp
 * @param {string[]} options.eventTypes - Event types to include
 * @param {number} options.limit - Maximum number of events to return
 * @returns {Object[]} - Performance events
 */
export function getPerformanceEvents(options = {}) {
  const {
    startTime = 0,
    endTime = Date.now(),
    eventTypes = null,
    limit = 100
  } = options;
  
  // Filter events
  let filteredEvents = performanceLog.events.filter(event => 
    event.timestamp >= startTime && event.timestamp <= endTime
  );
  
  // Filter by event types if specified
  if (eventTypes && eventTypes.length > 0) {
    filteredEvents = filteredEvents.filter(event => 
      eventTypes.includes(event.type)
    );
  }
  
  // Sort by timestamp (newest first)
  filteredEvents.sort((a, b) => b.timestamp - a.timestamp);
  
  // Apply limit
  if (limit > 0 && filteredEvents.length > limit) {
    filteredEvents = filteredEvents.slice(0, limit);
  }
  
  return filteredEvents;
}

/**
 * Generate a performance report
 * @param {Object} options - Report options
 * @param {number} options.timeRange - Time range in milliseconds (from now)
 * @param {boolean} options.includeResourceUsage - Whether to include resource usage
 * @param {boolean} options.includeEvents - Whether to include events
 * @param {boolean} options.includeBenchmarks - Whether to include benchmarks
 * @returns {Object} - Performance report
 */
export function generatePerformanceReport(options = {}) {
  const {
    timeRange = 3600000, // Default: last hour
    includeResourceUsage = true,
    includeEvents = true,
    includeBenchmarks = true
  } = options;
  
  const now = Date.now();
  const startTime = now - timeRange;
  
  // Get metrics for the time range
  const metrics = getPerformanceMetrics({
    startTime,
    endTime: now
  });
  
  // Build report
  const report = {
    generatedAt: now,
    timeRange: {
      start: startTime,
      end: now,
      durationMs: timeRange
    },
    summary: {
      eventCount: metrics.eventCount,
      resourceSamples: metrics.resourceSamples,
      metricCount: metrics.metrics.length
    },
    metrics: metrics.metrics
  };
  
  // Add resource usage if requested
  if (includeResourceUsage) {
    const resourceUsage = performanceLog.resourceUsage
      .filter(usage => usage.timestamp >= startTime)
      .map(usage => ({
        timestamp: usage.timestamp,
        cpu: usage.cpu,
        memory: usage.memory
      }));
    
    report.resourceUsage = resourceUsage;
    
    // Calculate resource usage statistics
    if (resourceUsage.length > 0) {
      const cpuValues = resourceUsage.map(u => u.cpu);
      const memoryValues = resourceUsage.map(u => u.memory);
      
      report.resourceStats = {
        cpu: calculateStatistics(cpuValues),
        memory: calculateStatistics(memoryValues)
      };
    }
  }
  
  // Add events if requested
  if (includeEvents) {
    report.events = getPerformanceEvents({
      startTime,
      endTime: now,
      limit: 100
    });
    
    // Group events by type
    const eventsByType = {};
    report.events.forEach(event => {
      if (!eventsByType[event.type]) {
        eventsByType[event.type] = 0;
      }
      eventsByType[event.type]++;
    });
    
    report.eventTypes = eventsByType;
  }
  
  // Add benchmarks if requested
  if (includeBenchmarks) {
    report.benchmarks = Array.from(performanceLog.benchmarks.values())
      .filter(benchmark => !benchmark.isRunning && benchmark.endTime >= startTime)
      .map(benchmark => ({
        name: benchmark.name,
        duration: benchmark.duration,
        measurementCount: benchmark.measurements.length,
        metadata: benchmark.metadata
      }));
  }
  
  // Log report generation
  logPerformanceEvent('performance-report-generated', {
    timeRangeMs: timeRange,
    metricCount: report.metrics.length,
    eventCount: includeEvents ? report.events.length : 0
  });
  
  return report;
}

/**
 * Clear performance logs
 * @param {Object} options - Clear options
 * @param {boolean} options.events - Whether to clear events
 * @param {boolean} options.metrics - Whether to clear metrics
 * @param {boolean} options.resourceUsage - Whether to clear resource usage
 * @param {boolean} options.benchmarks - Whether to clear benchmarks
 * @returns {Object} - Clear results
 */
export function clearPerformanceLogs(options = {}) {
  const {
    events = true,
    metrics = true,
    resourceUsage = true,
    benchmarks = true
  } = options;
  
  let clearedCount = 0;
  
  if (events) {
    clearedCount += performanceLog.events.length;
    performanceLog.events = [];
  }
  
  if (metrics) {
    clearedCount += performanceLog.metrics.size;
    performanceLog.metrics.clear();
  }
  
  if (resourceUsage) {
    clearedCount += performanceLog.resourceUsage.length;
    performanceLog.resourceUsage = [];
  }
  
  if (benchmarks) {
    clearedCount += performanceLog.benchmarks.size;
    performanceLog.benchmarks.clear();
  }
  
  // Log clear event
  logPerformanceEvent('performance-logs-cleared', {
    clearedCount,
    options
  });
  
  return {
    success: true,
    clearedCount,
    options
  };
}

/**
 * Enable or disable performance logging
 * @param {boolean} enabled - Whether logging is enabled
 * @returns {Object} - Result
 */
export function setLoggingEnabled(enabled) {
  const previousState = performanceLog.isLoggingEnabled;
  performanceLog.isLoggingEnabled = enabled;
  
  // Log event if we're enabling logging or if we're still enabled
  if (enabled || previousState) {
    logPerformanceEvent('performance-logging-state-changed', {
      enabled,
      previousState
    });
  }
  
  return {
    success: true,
    enabled,
    previousState
  };
}

/**
 * Set the maximum log size
 * @param {number} maxSize - Maximum number of events to store
 * @returns {Object} - Result
 */
export function setMaxLogSize(maxSize) {
  if (typeof maxSize !== 'number' || maxSize < 1) {
    throw new Error('Max log size must be a positive number');
  }
  
  const previousSize = performanceLog.maxLogSize;
  performanceLog.maxLogSize = maxSize;
  
  // Trim logs if they exceed new max size
  if (performanceLog.events.length > maxSize) {
    performanceLog.events = performanceLog.events.slice(-maxSize);
  }
  
  if (performanceLog.resourceUsage.length > maxSize) {
    performanceLog.resourceUsage = performanceLog.resourceUsage.slice(-maxSize);
  }
  
  // Log event
  logPerformanceEvent('performance-max-log-size-changed', {
    maxSize,
    previousSize
  });
  
  return {
    success: true,
    maxSize,
    previousSize
  };
}

// Helper functions

/**
 * Generate a unique event ID
 * @returns {string} - Unique ID
 */
function generateEventId() {
  return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Update a performance metric
 * @param {string} metricName - Metric name
 * @param {number} value - Metric value
 * @param {Object} context - Additional context
 * @returns {Object} - Updated metric
 */
function updateMetric(metricName, value, context = {}) {
  // Get or create metric
  let metric = performanceLog.metrics.get(metricName);
  
  if (!metric) {
    // Get definition if available
    const definition = metricDefinitions[metricName] || {
      name: metricName,
      unit: '',
      description: '',
      aggregation: 'average'
    };
    
    metric = {
      name: definition.name,
      unit: definition.unit,
      description: definition.description,
      aggregation: definition.aggregation,
      values: [],
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      lastUpdated: 0
    };
  }
  
  // Update metric
  metric.values.push({
    value,
    timestamp: Date.now(),
    context
  });
  
  // Trim values if they exceed max size
  if (metric.values.length > 100) {
    metric.values.shift();
  }
  
  // Update statistics
  metric.count++;
  metric.sum += value;
  metric.min = Math.min(metric.min, value);
  metric.max = Math.max(metric.max, value);
  metric.lastUpdated = Date.now();
  
  // Store updated metric
  performanceLog.metrics.set(metricName, metric);
  
  return metric;
}

/**
 * Calculate aggregated metrics
 * @param {Map<string, Object>} metrics - Metrics to aggregate
 * @returns {Object[]} - Aggregated metrics
 */
function calculateAggregatedMetrics(metrics) {
  return Array.from(metrics.entries()).map(([name, metric]) => {
    const aggregated = {
      name,
      displayName: metric.name,
      unit: metric.unit,
      description: metric.description,
      count: metric.count,
      min: metric.min,
      max: metric.max,
      lastUpdated: metric.lastUpdated
    };
    
    // Calculate aggregated value based on aggregation type
    switch (metric.aggregation) {
      case 'average':
        aggregated.value = metric.count > 0 ? metric.sum / metric.count : 0;
        break;
      case 'sum':
        aggregated.value = metric.sum;
        break;
      case 'last':
        aggregated.value = metric.values.length > 0 ? 
          metric.values[metric.values.length - 1].value : 0;
        break;
      default:
        aggregated.value = metric.count > 0 ? metric.sum / metric.count : 0;
    }
    
    return aggregated;
  });
}

/**
 * Calculate statistics for an array of values
 * @param {number[]} values - Values to analyze
 * @returns {Object} - Statistics
 */
function calculateStatistics(values) {
  if (!values || values.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      p95: 0,
      stdDev: 0
    };
  }
  
  // Sort values for percentile calculations
  const sortedValues = [...values].sort((a, b) => a - b);
  
  // Calculate statistics
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  const sum = sortedValues.reduce((acc, val) => acc + val, 0);
  const avg = sum / sortedValues.length;
  
  // Median
  const midIndex = Math.floor(sortedValues.length / 2);
  const median = sortedValues.length % 2 === 0 ?
    (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2 :
    sortedValues[midIndex];
  
  // 95th percentile
  const p95Index = Math.floor(sortedValues.length * 0.95);
  const p95 = sortedValues[p95Index];
  
  // Standard deviation
  const squaredDiffs = sortedValues.map(val => Math.pow(val - avg, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / sortedValues.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    min,
    max,
    avg,
    median,
    p95,
    stdDev
  };
}
