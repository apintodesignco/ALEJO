/**
 * ALEJO Unreal Engine Performance Monitor
 * 
 * This module tracks performance metrics for the Unreal Engine integration,
 * including frame rate, memory usage, loading times, and other performance indicators.
 * It provides tools for performance optimization and adaptive quality settings.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// Performance metrics
const metrics = {
  fps: {
    current: 0,
    average: 0,
    min: Infinity,
    max: 0,
    history: []
  },
  frameTime: {
    current: 0,
    average: 0,
    min: Infinity,
    max: 0,
    history: []
  },
  memory: {
    total: 0,
    used: 0,
    limit: 0,
    history: []
  },
  gpu: {
    usage: 0,
    temperature: 0,
    memory: {
      total: 0,
      used: 0
    }
  },
  loading: {
    times: {},
    active: 0,
    completed: 0,
    failed: 0
  },
  network: {
    latency: 0,
    bandwidth: 0,
    packetsLost: 0
  },
  quality: {
    current: 'auto',
    targetResolution: { width: 0, height: 0 },
    actualResolution: { width: 0, height: 0 },
    resolutionScale: 1.0
  }
};

// Performance thresholds
const thresholds = {
  fps: {
    excellent: 60,
    good: 45,
    acceptable: 30,
    poor: 20
  },
  frameTime: {
    excellent: 16, // ms (60 fps)
    good: 22, // ms (45 fps)
    acceptable: 33, // ms (30 fps)
    poor: 50 // ms (20 fps)
  },
  memory: {
    warning: 0.8, // 80% of available memory
    critical: 0.9 // 90% of available memory
  }
};

// Monitoring state
let isMonitoring = false;
let monitoringInterval = null;
let frameCounterInterval = null;
let lastFrameTime = 0;
let frameCount = 0;
let historyLength = 60; // Number of samples to keep in history

// Default configuration
const DEFAULT_CONFIG = {
  monitoringEnabled: true,
  monitoringInterval: 1000, // ms
  adaptiveQualityEnabled: true,
  historyLength: 60,
  fpsTarget: 60,
  fpsMin: 30,
  memoryLimit: 0, // 0 means auto-detect
  reportInterval: 5000, // ms
  logPerformanceIssues: true,
  adaptationStrategy: 'balanced' // 'quality', 'balanced', 'performance'
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

/**
 * Initializes the performance monitor
 * @param {Object} options - Configuration options
 * @returns {Object} - Performance monitor API
 */
export function initializePerformanceMonitor(options = {}) {
  console.log('Initializing ALEJO Unreal Engine Performance Monitor');
  
  // Merge with default configuration
  config = {
    ...DEFAULT_CONFIG,
    ...options
  };
  
  // Set history length
  historyLength = config.historyLength;
  
  // Set up event listeners
  setupEventListeners();
  
  // Start monitoring if enabled
  if (config.monitoringEnabled) {
    startMonitoring();
  }
  
  // Return public API
  return {
    startMonitoring,
    stopMonitoring,
    getMetrics,
    getPerformanceStatus,
    updateConfig,
    markLoadStart,
    markLoadEnd,
    setQualityLevel,
    getRecommendedQuality,
    getThresholds
  };
}

/**
 * Sets up event listeners
 */
function setupEventListeners() {
  // Listen for rendering events
  subscribe('unreal:rendering:frame', handleFrameRendered);
  
  // Listen for loading events
  subscribe('unreal:asset:loading', handleAssetLoading);
  subscribe('unreal:asset:loaded', handleAssetLoaded);
  subscribe('unreal:asset:error', handleAssetError);
  
  // Listen for network events
  subscribe('unreal:network:stats', handleNetworkStats);
  
  // Listen for memory warnings
  window.addEventListener('beforeunload', reportFinalMetrics);
}

/**
 * Starts performance monitoring
 */
export function startMonitoring() {
  if (isMonitoring) return;
  
  console.log('Starting performance monitoring');
  isMonitoring = true;
  lastFrameTime = performance.now();
  frameCount = 0;
  
  // Set up monitoring interval
  monitoringInterval = setInterval(() => {
    updateMetrics();
    
    // Check for performance issues
    if (config.logPerformanceIssues) {
      checkPerformanceIssues();
    }
    
    // Apply adaptive quality if enabled
    if (config.adaptiveQualityEnabled) {
      applyAdaptiveQuality();
    }
  }, config.monitoringInterval);
  
  // Set up frame counter interval
  frameCounterInterval = setInterval(() => {
    // Calculate FPS
    const fps = frameCount;
    updateFpsMetrics(fps);
    frameCount = 0;
    
    // Publish metrics update event
    publish('unreal:performance:update', { metrics });
  }, 1000);
}

/**
 * Stops performance monitoring
 */
export function stopMonitoring() {
  if (!isMonitoring) return;
  
  console.log('Stopping performance monitoring');
  isMonitoring = false;
  
  // Clear intervals
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  if (frameCounterInterval) {
    clearInterval(frameCounterInterval);
    frameCounterInterval = null;
  }
}

/**
 * Updates performance metrics
 */
function updateMetrics() {
  // Update memory metrics
  updateMemoryMetrics();
  
  // Update GPU metrics if available
  updateGpuMetrics();
  
  // Update quality metrics
  updateQualityMetrics();
}

/**
 * Updates FPS metrics
 * @param {number} fps - Current FPS
 */
function updateFpsMetrics(fps) {
  // Update current FPS
  metrics.fps.current = fps;
  
  // Update min/max
  metrics.fps.min = Math.min(metrics.fps.min, fps);
  metrics.fps.max = Math.max(metrics.fps.max, fps);
  
  // Add to history
  metrics.fps.history.push(fps);
  if (metrics.fps.history.length > historyLength) {
    metrics.fps.history.shift();
  }
  
  // Calculate average
  metrics.fps.average = metrics.fps.history.reduce((sum, value) => sum + value, 0) / metrics.fps.history.length;
}

/**
 * Updates frame time metrics
 * @param {number} frameTime - Current frame time in ms
 */
function updateFrameTimeMetrics(frameTime) {
  // Update current frame time
  metrics.frameTime.current = frameTime;
  
  // Update min/max
  metrics.frameTime.min = Math.min(metrics.frameTime.min, frameTime);
  metrics.frameTime.max = Math.max(metrics.frameTime.max, frameTime);
  
  // Add to history
  metrics.frameTime.history.push(frameTime);
  if (metrics.frameTime.history.length > historyLength) {
    metrics.frameTime.history.shift();
  }
  
  // Calculate average
  metrics.frameTime.average = metrics.frameTime.history.reduce((sum, value) => sum + value, 0) / metrics.frameTime.history.length;
}

/**
 * Updates memory metrics
 */
function updateMemoryMetrics() {
  // Get memory info if available
  if (performance.memory) {
    metrics.memory.total = performance.memory.jsHeapSizeLimit;
    metrics.memory.used = performance.memory.usedJSHeapSize;
    metrics.memory.limit = config.memoryLimit || performance.memory.jsHeapSizeLimit;
    
    // Add to history
    metrics.memory.history.push(metrics.memory.used);
    if (metrics.memory.history.length > historyLength) {
      metrics.memory.history.shift();
    }
    
    // Check if memory usage is high
    const memoryUsage = metrics.memory.used / metrics.memory.limit;
    if (memoryUsage > thresholds.memory.critical) {
      publish('system:memory:critical', { usage: memoryUsage });
    } else if (memoryUsage > thresholds.memory.warning) {
      publish('system:memory:low', { usage: memoryUsage });
    }
  }
}

/**
 * Updates GPU metrics
 */
function updateGpuMetrics() {
  // GPU metrics are not directly available in browsers
  // This would be populated by the Unreal Engine integration
  // through events or direct calls
}

/**
 * Updates quality metrics
 */
function updateQualityMetrics() {
  // Get actual resolution from canvas if available
  const canvas = document.querySelector('#alejo-unreal-container canvas');
  if (canvas) {
    metrics.quality.actualResolution.width = canvas.width;
    metrics.quality.actualResolution.height = canvas.height;
  }
  
  // Calculate resolution scale
  if (metrics.quality.targetResolution.width > 0) {
    metrics.quality.resolutionScale = metrics.quality.actualResolution.width / metrics.quality.targetResolution.width;
  }
}

/**
 * Handles frame rendered event
 * @param {Object} event - Frame event
 */
function handleFrameRendered(event) {
  if (!isMonitoring) return;
  
  // Increment frame count
  frameCount++;
  
  // Calculate frame time
  const now = performance.now();
  const frameTime = now - lastFrameTime;
  lastFrameTime = now;
  
  // Update frame time metrics
  updateFrameTimeMetrics(frameTime);
}

/**
 * Handles asset loading event
 * @param {Object} event - Asset loading event
 */
function handleAssetLoading(event) {
  if (!event.url) return;
  
  // Record load start time
  markLoadStart(event.url);
  
  // Increment active loading count
  metrics.loading.active++;
}

/**
 * Handles asset loaded event
 * @param {Object} event - Asset loaded event
 */
function handleAssetLoaded(event) {
  if (!event.url) return;
  
  // Record load end time
  markLoadEnd(event.url);
  
  // Update loading metrics
  metrics.loading.active--;
  metrics.loading.completed++;
}

/**
 * Handles asset error event
 * @param {Object} event - Asset error event
 */
function handleAssetError(event) {
  if (!event.url) return;
  
  // Update loading metrics
  metrics.loading.active--;
  metrics.loading.failed++;
}

/**
 * Handles network stats event
 * @param {Object} event - Network stats event
 */
function handleNetworkStats(event) {
  if (!event.stats) return;
  
  // Update network metrics
  if (event.stats.latency !== undefined) {
    metrics.network.latency = event.stats.latency;
  }
  
  if (event.stats.bandwidth !== undefined) {
    metrics.network.bandwidth = event.stats.bandwidth;
  }
  
  if (event.stats.packetsLost !== undefined) {
    metrics.network.packetsLost = event.stats.packetsLost;
  }
}

/**
 * Checks for performance issues
 */
function checkPerformanceIssues() {
  const status = getPerformanceStatus();
  
  // Check FPS
  if (status.fps === 'poor') {
    console.warn('Poor framerate detected:', metrics.fps.current, 'FPS');
    publish('unreal:performance:issue', {
      type: 'fps',
      severity: 'high',
      message: `Low framerate: ${metrics.fps.current.toFixed(1)} FPS`,
      metrics: { ...metrics.fps }
    });
  } else if (status.fps === 'acceptable' && metrics.fps.current < config.fpsMin) {
    console.warn('Framerate below target:', metrics.fps.current, 'FPS');
    publish('unreal:performance:issue', {
      type: 'fps',
      severity: 'medium',
      message: `Framerate below target: ${metrics.fps.current.toFixed(1)} FPS`,
      metrics: { ...metrics.fps }
    });
  }
  
  // Check memory
  if (metrics.memory.total > 0) {
    const memoryUsage = metrics.memory.used / metrics.memory.total;
    
    if (memoryUsage > thresholds.memory.critical) {
      console.warn('Critical memory usage:', (memoryUsage * 100).toFixed(1), '%');
      publish('unreal:performance:issue', {
        type: 'memory',
        severity: 'high',
        message: `Critical memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
        metrics: { ...metrics.memory }
      });
    } else if (memoryUsage > thresholds.memory.warning) {
      console.warn('High memory usage:', (memoryUsage * 100).toFixed(1), '%');
      publish('unreal:performance:issue', {
        type: 'memory',
        severity: 'medium',
        message: `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
        metrics: { ...metrics.memory }
      });
    }
  }
}

/**
 * Applies adaptive quality settings
 */
function applyAdaptiveQuality() {
  if (!config.adaptiveQualityEnabled) return;
  
  // Get current performance status
  const status = getPerformanceStatus();
  
  // Get recommended quality level
  const recommendedQuality = getRecommendedQuality();
  
  // If quality needs to change, publish event
  if (recommendedQuality !== metrics.quality.current) {
    console.log(`Adaptive quality: changing from ${metrics.quality.current} to ${recommendedQuality}`);
    
    publish('unreal:quality:change', {
      from: metrics.quality.current,
      to: recommendedQuality,
      reason: status
    });
    
    // Update current quality
    metrics.quality.current = recommendedQuality;
  }
}

/**
 * Gets current performance metrics
 * @returns {Object} - Current performance metrics
 */
export function getMetrics() {
  return { ...metrics };
}

/**
 * Gets current performance status
 * @returns {Object} - Performance status
 */
export function getPerformanceStatus() {
  const status = {
    fps: 'unknown',
    memory: 'unknown',
    overall: 'unknown'
  };
  
  // Determine FPS status
  if (metrics.fps.average >= thresholds.fps.excellent) {
    status.fps = 'excellent';
  } else if (metrics.fps.average >= thresholds.fps.good) {
    status.fps = 'good';
  } else if (metrics.fps.average >= thresholds.fps.acceptable) {
    status.fps = 'acceptable';
  } else if (metrics.fps.average > 0) {
    status.fps = 'poor';
  }
  
  // Determine memory status
  if (metrics.memory.total > 0) {
    const memoryUsage = metrics.memory.used / metrics.memory.total;
    
    if (memoryUsage < thresholds.memory.warning) {
      status.memory = 'good';
    } else if (memoryUsage < thresholds.memory.critical) {
      status.memory = 'warning';
    } else {
      status.memory = 'critical';
    }
  }
  
  // Determine overall status (worst of the individual statuses)
  if (status.fps === 'poor' || status.memory === 'critical') {
    status.overall = 'poor';
  } else if (status.fps === 'acceptable' || status.memory === 'warning') {
    status.overall = 'acceptable';
  } else if (status.fps === 'good' && status.memory !== 'unknown') {
    status.overall = 'good';
  } else if (status.fps === 'excellent' && status.memory === 'good') {
    status.overall = 'excellent';
  }
  
  return status;
}

/**
 * Updates performance monitor configuration
 * @param {Object} newConfig - New configuration options
 */
export function updateConfig(newConfig) {
  // Update configuration
  config = {
    ...config,
    ...newConfig
  };
  
  // Update history length if changed
  if (newConfig.historyLength && newConfig.historyLength !== historyLength) {
    historyLength = newConfig.historyLength;
    
    // Trim histories if needed
    if (metrics.fps.history.length > historyLength) {
      metrics.fps.history = metrics.fps.history.slice(-historyLength);
    }
    
    if (metrics.frameTime.history.length > historyLength) {
      metrics.frameTime.history = metrics.frameTime.history.slice(-historyLength);
    }
    
    if (metrics.memory.history.length > historyLength) {
      metrics.memory.history = metrics.memory.history.slice(-historyLength);
    }
  }
  
  // Restart monitoring if interval changed
  if (newConfig.monitoringInterval && isMonitoring) {
    stopMonitoring();
    startMonitoring();
  }
  
  // Enable/disable monitoring if changed
  if (newConfig.monitoringEnabled !== undefined) {
    if (newConfig.monitoringEnabled && !isMonitoring) {
      startMonitoring();
    } else if (!newConfig.monitoringEnabled && isMonitoring) {
      stopMonitoring();
    }
  }
}

/**
 * Marks the start of loading an asset
 * @param {string} id - Asset identifier
 */
export function markLoadStart(id) {
  metrics.loading.times[id] = {
    start: performance.now(),
    end: null,
    duration: null
  };
}

/**
 * Marks the end of loading an asset
 * @param {string} id - Asset identifier
 * @returns {number} - Loading duration in ms
 */
export function markLoadEnd(id) {
  if (!metrics.loading.times[id]) {
    return 0;
  }
  
  const now = performance.now();
  metrics.loading.times[id].end = now;
  metrics.loading.times[id].duration = now - metrics.loading.times[id].start;
  
  return metrics.loading.times[id].duration;
}

/**
 * Sets the quality level
 * @param {string} level - Quality level ('low', 'medium', 'high', 'ultra', 'auto')
 * @param {Object} settings - Quality settings
 */
export function setQualityLevel(level, settings = {}) {
  // Update quality metrics
  metrics.quality.current = level;
  
  // Update target resolution if provided
  if (settings.targetResolution) {
    metrics.quality.targetResolution = { ...settings.targetResolution };
  }
  
  // Publish quality change event
  publish('unreal:quality:set', {
    level,
    settings
  });
}

/**
 * Gets the recommended quality level based on performance
 * @returns {string} - Recommended quality level
 */
export function getRecommendedQuality() {
  const status = getPerformanceStatus();
  
  // If performance is poor, recommend low quality
  if (status.overall === 'poor') {
    return 'low';
  }
  
  // If performance is excellent, recommend high quality
  if (status.overall === 'excellent') {
    return 'high';
  }
  
  // For acceptable performance, use the adaptation strategy
  if (status.overall === 'acceptable') {
    switch (config.adaptationStrategy) {
      case 'quality':
        return 'medium';
      case 'performance':
        return 'low';
      case 'balanced':
      default:
        // If FPS is the issue, prioritize performance
        if (status.fps === 'acceptable' && status.memory === 'good') {
          return 'low';
        }
        // If memory is the issue, try medium quality
        return 'medium';
    }
  }
  
  // For good performance, use the adaptation strategy
  if (status.overall === 'good') {
    switch (config.adaptationStrategy) {
      case 'quality':
        return 'high';
      case 'performance':
        return 'medium';
      case 'balanced':
      default:
        return 'medium';
    }
  }
  
  // Default to auto
  return 'auto';
}

/**
 * Gets performance thresholds
 * @returns {Object} - Performance thresholds
 */
export function getThresholds() {
  return { ...thresholds };
}

/**
 * Reports final metrics before page unload
 */
function reportFinalMetrics() {
  if (!isMonitoring) return;
  
  // Create final report
  const finalReport = {
    fps: {
      average: metrics.fps.average,
      min: metrics.fps.min,
      max: metrics.fps.max
    },
    frameTime: {
      average: metrics.frameTime.average,
      min: metrics.frameTime.min,
      max: metrics.frameTime.max
    },
    memory: {
      peak: Math.max(...metrics.memory.history)
    },
    loading: {
      completed: metrics.loading.completed,
      failed: metrics.loading.failed
    },
    quality: {
      final: metrics.quality.current
    }
  };
  
  // Send final report
  try {
    // Use sendBeacon if available for reliable delivery during page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({
        type: 'unreal:performance:final',
        data: finalReport
      })], { type: 'application/json' });
      
      navigator.sendBeacon('/api/telemetry/performance', blob);
    }
  } catch (error) {
    console.error('Failed to send final performance report:', error);
  }
}

export default {
  initializePerformanceMonitor,
  startMonitoring,
  stopMonitoring,
  getMetrics,
  getPerformanceStatus,
  updateConfig,
  markLoadStart,
  markLoadEnd,
  setQualityLevel,
  getRecommendedQuality,
  getThresholds
};
