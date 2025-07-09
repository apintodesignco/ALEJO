/**
 * ALEJO Performance Visualization Core
 * 
 * Core functionality for visualizing performance metrics and benchmark results.
 * This module provides the foundation for creating performance visualizations.
 */

import { publishEvent, subscribeToEvent } from '../../core/neural-architecture/neural-event-bus.js';
import { logPerformanceEvent } from '../performance-logger.js';

// Default chart configuration
const DEFAULT_CHART_CONFIG = {
  width: 600,
  height: 400,
  margin: { top: 20, right: 30, bottom: 40, left: 50 },
  colors: [
    '#4285F4', // blue
    '#EA4335', // red
    '#FBBC05', // yellow
    '#34A853', // green
    '#8AB4F8', // light blue
    '#F6AEA9', // light red
    '#FDE293', // light yellow
    '#A8DAB5'  // light green
  ],
  animation: {
    duration: 500,
    easing: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)'
  },
  accessibility: {
    enableKeyboardNavigation: true,
    includeDescriptiveText: true,
    highContrastMode: false
  }
};

/**
 * Initialize the visualization system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
export async function initializeVisualization(options = {}) {
  try {
    // Merge options with defaults
    const config = {
      ...DEFAULT_CHART_CONFIG,
      ...options
    };
    
    // Subscribe to relevant events
    subscribeToEvent('performance-logger:report-generated', handleReportGenerated);
    subscribeToEvent('performance-benchmarking:benchmark-completed', handleBenchmarkCompleted);
    
    // Log initialization
    logPerformanceEvent('visualization-initialized', {
      timestamp: Date.now(),
      config
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize visualization system:', error);
    return false;
  }
}

/**
 * Create a container element for a visualization
 * @param {string} id - Element ID
 * @param {string} title - Chart title
 * @param {Object} options - Container options
 * @returns {HTMLElement} - Container element
 */
export function createVisualizationContainer(id, title, options = {}) {
  // Create container
  const container = document.createElement('div');
  container.id = id;
  container.className = 'alejo-visualization-container';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', `${title} visualization`);
  
  // Set styles
  Object.assign(container.style, {
    width: `${options.width || DEFAULT_CHART_CONFIG.width}px`,
    height: `${options.height || DEFAULT_CHART_CONFIG.height}px`,
    position: 'relative',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box',
    overflow: 'hidden'
  });
  
  // Create header
  const header = document.createElement('div');
  header.className = 'alejo-visualization-header';
  header.textContent = title;
  Object.assign(header.style, {
    padding: '10px',
    fontWeight: 'bold',
    borderBottom: '1px solid #ddd'
  });
  
  // Create content area
  const content = document.createElement('div');
  content.className = 'alejo-visualization-content';
  content.setAttribute('role', 'img');
  content.setAttribute('aria-label', `${title} chart`);
  Object.assign(content.style, {
    padding: '10px',
    height: 'calc(100% - 40px)'
  });
  
  // Append elements
  container.appendChild(header);
  container.appendChild(content);
  
  return container;
}

/**
 * Format a value for display
 * @param {number} value - Value to format
 * @param {string} type - Value type (percentage, bytes, milliseconds, etc.)
 * @returns {string} - Formatted value
 */
export function formatValue(value, type = 'number') {
  switch (type.toLowerCase()) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'bytes':
      return formatBytes(value);
    case 'milliseconds':
      return formatTime(value);
    case 'seconds':
      return formatTime(value * 1000);
    default:
      return value.toLocaleString();
  }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes
 * @returns {string} - Formatted string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format time in milliseconds to human-readable string
 * @param {number} ms - Time in milliseconds
 * @returns {string} - Formatted string
 */
export function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculate statistics for a dataset
 * @param {Array<number>} data - Dataset
 * @returns {Object} - Statistics
 */
export function calculateStatistics(data) {
  if (!data || data.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      percentile95: 0,
      percentile99: 0
    };
  }
  
  // Sort data for percentiles and median
  const sortedData = [...data].sort((a, b) => a - b);
  
  // Calculate statistics
  const min = sortedData[0];
  const max = sortedData[sortedData.length - 1];
  const sum = sortedData.reduce((acc, val) => acc + val, 0);
  const mean = sum / sortedData.length;
  
  // Median
  const midIndex = Math.floor(sortedData.length / 2);
  const median = sortedData.length % 2 === 0
    ? (sortedData[midIndex - 1] + sortedData[midIndex]) / 2
    : sortedData[midIndex];
  
  // Standard deviation
  const squaredDiffs = sortedData.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / sortedData.length;
  const stdDev = Math.sqrt(variance);
  
  // Percentiles
  const p95Index = Math.ceil(sortedData.length * 0.95) - 1;
  const p99Index = Math.ceil(sortedData.length * 0.99) - 1;
  const percentile95 = sortedData[p95Index];
  const percentile99 = sortedData[p99Index];
  
  return {
    min,
    max,
    mean,
    median,
    stdDev,
    percentile95,
    percentile99
  };
}

/**
 * Generate a unique ID for a visualization element
 * @param {string} prefix - ID prefix
 * @returns {string} - Unique ID
 */
export function generateUniqueId(prefix = 'viz') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handle report generated event
 * @param {Object} data - Event data
 */
function handleReportGenerated(data) {
  // This will be implemented in the report visualization module
  publishEvent('visualization:report-received', {
    reportId: data.reportId,
    timestamp: Date.now()
  });
}

/**
 * Handle benchmark completed event
 * @param {Object} data - Event data
 */
function handleBenchmarkCompleted(data) {
  // This will be implemented in the benchmark visualization module
  publishEvent('visualization:benchmark-received', {
    benchmarkId: data.benchmarkId,
    timestamp: Date.now()
  });
}

/**
 * Create an accessible SVG element
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @param {Object} options - SVG options
 * @returns {SVGElement} - SVG element
 */
export function createSVG(width, height, options = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  
  // Set attributes
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', options.titleId || '');
  
  // Add title for accessibility
  if (options.title) {
    const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleElement.id = options.titleId || generateUniqueId('title');
    titleElement.textContent = options.title;
    svg.appendChild(titleElement);
  }
  
  // Add description for accessibility
  if (options.description) {
    const descElement = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
    descElement.textContent = options.description;
    svg.appendChild(descElement);
  }
  
  return svg;
}

/**
 * Create a linear scale for mapping data values to visual properties
 * @param {Array} domain - Input domain [min, max]
 * @param {Array} range - Output range [min, max]
 * @returns {Function} - Scale function
 */
export function createLinearScale(domain, range) {
  const domainMin = domain[0];
  const domainMax = domain[1];
  const rangeMin = range[0];
  const rangeMax = range[1];
  
  return value => {
    // Handle edge cases
    if (domainMax === domainMin) return rangeMin;
    
    // Calculate normalized position in domain (0 to 1)
    const normalizedPosition = (value - domainMin) / (domainMax - domainMin);
    
    // Map to range
    return rangeMin + normalizedPosition * (rangeMax - rangeMin);
  };
}

/**
 * Create a time scale for mapping time values to visual properties
 * @param {Array} domain - Input domain [minDate, maxDate]
 * @param {Array} range - Output range [min, max]
 * @returns {Function} - Scale function
 */
export function createTimeScale(domain, range) {
  const domainMin = domain[0].getTime();
  const domainMax = domain[1].getTime();
  const rangeMin = range[0];
  const rangeMax = range[1];
  
  return date => {
    // Handle edge cases
    if (domainMax === domainMin) return rangeMin;
    
    // Calculate normalized position in domain (0 to 1)
    const normalizedPosition = (date.getTime() - domainMin) / (domainMax - domainMin);
    
    // Map to range
    return rangeMin + normalizedPosition * (rangeMax - rangeMin);
  };
}

/**
 * Create a categorical scale for mapping categories to visual properties
 * @param {Array} domain - Input domain (categories)
 * @param {Array} range - Output range (values)
 * @returns {Function} - Scale function
 */
export function createCategoricalScale(domain, range) {
  return category => {
    const index = domain.indexOf(category);
    return index >= 0 ? range[index % range.length] : null;
  };
}

/**
 * Export visualization data to CSV
 * @param {Array} data - Data to export
 * @param {Array} columns - Column definitions
 * @returns {string} - CSV content
 */
export function exportToCSV(data, columns) {
  // Create header row
  const header = columns.map(col => `"${col.label}"`).join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return columns.map(col => {
      const value = item[col.key];
      return typeof value === 'string' ? `"${value}"` : value;
    }).join(',');
  });
  
  // Combine header and rows
  return [header, ...rows].join('\n');
}

/**
 * Create a download link for exporting data
 * @param {string} content - Content to download
 * @param {string} filename - Download filename
 * @param {string} mimeType - MIME type
 * @returns {HTMLAnchorElement} - Download link
 */
export function createDownloadLink(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.textContent = `Download ${filename}`;
  link.className = 'alejo-download-link';
  
  // Clean up object URL on click
  link.addEventListener('click', () => {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  });
  
  return link;
}
