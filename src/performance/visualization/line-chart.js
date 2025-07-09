/**
 * ALEJO Performance Line Chart Visualization
 * 
 * This module provides functionality for creating line charts to visualize
 * performance metrics over time, such as CPU usage, memory consumption,
 * response times, and other time-series data.
 */

import {
  createVisualizationContainer,
  createSVG,
  createLinearScale,
  createTimeScale,
  formatValue,
  calculateStatistics,
  generateUniqueId
} from './visualization-core.js';
import { logPerformanceEvent } from '../performance-logger.js';

/**
 * Create a line chart visualization
 * @param {string} containerId - ID of the container element
 * @param {Object} options - Chart options
 * @returns {Object} - Chart API
 */
export function createLineChart(containerId, options = {}) {
  // Default options
  const config = {
    title: 'Performance Metrics',
    width: 600,
    height: 400,
    margin: { top: 20, right: 30, bottom: 40, left: 50 },
    xAxis: {
      label: 'Time',
      tickCount: 5,
      tickFormat: value => new Date(value).toLocaleTimeString()
    },
    yAxis: {
      label: 'Value',
      tickCount: 5,
      tickFormat: value => value.toFixed(1)
    },
    lines: [],
    animate: true,
    showLegend: true,
    showTooltip: true,
    showStatistics: false,
    ...options
  };
  
  // State
  let svg = null;
  let tooltip = null;
  let container = null;
  let chartWidth = 0;
  let chartHeight = 0;
  let xScale = null;
  let yScale = null;
  
  /**
   * Initialize the chart
   */
  function initialize() {
    // Get or create container
    container = document.getElementById(containerId);
    if (!container) {
      container = createVisualizationContainer(containerId, config.title, {
        width: config.width,
        height: config.height
      });
      document.body.appendChild(container);
    }
    
    // Clear container content
    const content = container.querySelector('.alejo-visualization-content');
    content.innerHTML = '';
    
    // Calculate dimensions
    chartWidth = config.width - config.margin.left - config.margin.right;
    chartHeight = config.height - config.margin.top - config.margin.bottom;
    
    // Create SVG
    svg = createSVG(config.width, config.height, {
      title: config.title,
      description: `Line chart showing ${config.title}`
    });
    content.appendChild(svg);
    
    // Create tooltip if enabled
    if (config.showTooltip) {
      tooltip = createTooltip();
      content.appendChild(tooltip);
    }
    
    // Create legend if enabled
    if (config.showLegend) {
      const legend = createLegend();
      content.appendChild(legend);
    }
    
    // Create statistics panel if enabled
    if (config.showStatistics) {
      const statistics = createStatisticsPanel();
      content.appendChild(statistics);
    }
    
    // Draw chart
    draw();
    
    // Log event
    logPerformanceEvent('line-chart-created', {
      chartId: containerId,
      timestamp: Date.now(),
      config: {
        title: config.title,
        width: config.width,
        height: config.height
      }
    });
    
    return api;
  }
  
  /**
   * Draw the chart
   */
  function draw() {
    // Clear existing elements
    svg.innerHTML = '';
    
    // Create title and description for accessibility
    const titleId = generateUniqueId('chart-title');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.id = titleId;
    title.textContent = config.title;
    svg.appendChild(title);
    
    const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
    desc.textContent = `Line chart showing ${config.title} over time`;
    svg.appendChild(desc);
    
    // Create chart group
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', `translate(${config.margin.left},${config.margin.top})`);
    svg.appendChild(chartGroup);
    
    // Calculate domains
    const allPoints = config.lines.flatMap(line => line.data);
    const xDomain = [
      Math.min(...allPoints.map(d => d.x)),
      Math.max(...allPoints.map(d => d.x))
    ];
    const yDomain = [
      Math.min(0, ...allPoints.map(d => d.y)),
      Math.max(...allPoints.map(d => d.y)) * 1.1 // Add 10% padding
    ];
    
    // Create scales
    xScale = typeof xDomain[0] === 'number' 
      ? createLinearScale(xDomain, [0, chartWidth])
      : createTimeScale(xDomain, [0, chartWidth]);
    
    yScale = createLinearScale(yDomain, [chartHeight, 0]);
    
    // Draw axes
    drawXAxis(chartGroup);
    drawYAxis(chartGroup);
    
    // Draw lines
    drawLines(chartGroup);
    
    // Update legend
    if (config.showLegend) {
      updateLegend();
    }
    
    // Update statistics
    if (config.showStatistics) {
      updateStatistics();
    }
  }
  
  /**
   * Draw X axis
   * @param {SVGElement} parent - Parent element
   */
  function drawXAxis(parent) {
    // Create axis group
    const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    axisGroup.setAttribute('class', 'x-axis');
    axisGroup.setAttribute('transform', `translate(0,${chartHeight})`);
    
    // Draw axis line
    const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisLine.setAttribute('x1', 0);
    axisLine.setAttribute('y1', 0);
    axisLine.setAttribute('x2', chartWidth);
    axisLine.setAttribute('y2', 0);
    axisLine.setAttribute('stroke', '#000');
    axisGroup.appendChild(axisLine);
    
    // Draw ticks
    const tickValues = generateTickValues(xScale, config.xAxis.tickCount);
    tickValues.forEach(value => {
      const x = xScale(value);
      
      // Tick line
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', x);
      tick.setAttribute('y1', 0);
      tick.setAttribute('x2', x);
      tick.setAttribute('y2', 6);
      tick.setAttribute('stroke', '#000');
      axisGroup.appendChild(tick);
      
      // Tick label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', 20);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '12px');
      label.textContent = config.xAxis.tickFormat(value);
      axisGroup.appendChild(label);
    });
    
    // Draw axis label
    const axisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    axisLabel.setAttribute('x', chartWidth / 2);
    axisLabel.setAttribute('y', 35);
    axisLabel.setAttribute('text-anchor', 'middle');
    axisLabel.setAttribute('font-size', '12px');
    axisLabel.setAttribute('font-weight', 'bold');
    axisLabel.textContent = config.xAxis.label;
    axisGroup.appendChild(axisLabel);
    
    parent.appendChild(axisGroup);
  }
  
  /**
   * Draw Y axis
   * @param {SVGElement} parent - Parent element
   */
  function drawYAxis(parent) {
    // Create axis group
    const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    axisGroup.setAttribute('class', 'y-axis');
    
    // Draw axis line
    const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisLine.setAttribute('x1', 0);
    axisLine.setAttribute('y1', 0);
    axisLine.setAttribute('x2', 0);
    axisLine.setAttribute('y2', chartHeight);
    axisLine.setAttribute('stroke', '#000');
    axisGroup.appendChild(axisLine);
    
    // Draw ticks
    const tickValues = generateTickValues(yScale, config.yAxis.tickCount);
    tickValues.forEach(value => {
      const y = yScale(value);
      
      // Tick line
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', 0);
      tick.setAttribute('y1', y);
      tick.setAttribute('x2', -6);
      tick.setAttribute('y2', y);
      tick.setAttribute('stroke', '#000');
      axisGroup.appendChild(tick);
      
      // Tick label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', -10);
      label.setAttribute('y', y + 4);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '12px');
      label.textContent = config.yAxis.tickFormat(value);
      axisGroup.appendChild(label);
      
      // Grid line
      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', 0);
      gridLine.setAttribute('y1', y);
      gridLine.setAttribute('x2', chartWidth);
      gridLine.setAttribute('y2', y);
      gridLine.setAttribute('stroke', '#e0e0e0');
      gridLine.setAttribute('stroke-dasharray', '2,2');
      axisGroup.appendChild(gridLine);
    });
    
    // Draw axis label
    const axisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    axisLabel.setAttribute('transform', `translate(-35,${chartHeight / 2}) rotate(-90)`);
    axisLabel.setAttribute('text-anchor', 'middle');
    axisLabel.setAttribute('font-size', '12px');
    axisLabel.setAttribute('font-weight', 'bold');
    axisLabel.textContent = config.yAxis.label;
    axisGroup.appendChild(axisLabel);
    
    parent.appendChild(axisGroup);
  }
  
  /**
   * Draw lines
   * @param {SVGElement} parent - Parent element
   */
  function drawLines(parent) {
    config.lines.forEach((line, index) => {
      // Skip if no data
      if (!line.data || line.data.length === 0) return;
      
      // Create line path
      const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      linePath.setAttribute('fill', 'none');
      linePath.setAttribute('stroke', line.color || getColor(index));
      linePath.setAttribute('stroke-width', line.width || 2);
      linePath.setAttribute('d', generateLinePath(line.data));
      
      // Add animation if enabled
      if (config.animate) {
        const length = linePath.getTotalLength();
        linePath.setAttribute('stroke-dasharray', length);
        linePath.setAttribute('stroke-dashoffset', length);
        linePath.style.transition = `stroke-dashoffset 1s ease-in-out`;
        setTimeout(() => {
          linePath.setAttribute('stroke-dashoffset', 0);
        }, 100);
      }
      
      parent.appendChild(linePath);
      
      // Draw data points
      line.data.forEach(point => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', xScale(point.x));
        circle.setAttribute('cy', yScale(point.y));
        circle.setAttribute('r', 4);
        circle.setAttribute('fill', line.color || getColor(index));
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', 1);
        
        // Add hover effect
        if (config.showTooltip) {
          circle.addEventListener('mouseover', () => {
            circle.setAttribute('r', 6);
            showTooltip(point, line, circle);
          });
          
          circle.addEventListener('mouseout', () => {
            circle.setAttribute('r', 4);
            hideTooltip();
          });
        }
        
        parent.appendChild(circle);
      });
    });
  }
  
  /**
   * Create tooltip element
   * @returns {HTMLElement} - Tooltip element
   */
  function createTooltip() {
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'alejo-chart-tooltip';
    Object.assign(tooltipElement.style, {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      padding: '8px',
      borderRadius: '4px',
      fontSize: '12px',
      pointerEvents: 'none',
      opacity: 0,
      transition: 'opacity 0.2s',
      zIndex: 1000,
      maxWidth: '200px'
    });
    
    return tooltipElement;
  }
  
  /**
   * Show tooltip
   * @param {Object} point - Data point
   * @param {Object} line - Line configuration
   * @param {SVGElement} element - Target element
   */
  function showTooltip(point, line, element) {
    // Get element position
    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Format tooltip content
    const xValue = typeof point.x === 'number' 
      ? point.x.toLocaleString() 
      : new Date(point.x).toLocaleString();
    
    const yValue = formatValue(point.y, line.valueType || 'number');
    
    tooltip.innerHTML = `
      <div><strong>${line.label || 'Value'}</strong></div>
      <div>${config.xAxis.label}: ${xValue}</div>
      <div>${config.yAxis.label}: ${yValue}</div>
      ${point.label ? `<div>${point.label}</div>` : ''}
    `;
    
    // Position tooltip
    const left = rect.left - containerRect.left + rect.width / 2;
    const top = rect.top - containerRect.top - tooltip.offsetHeight - 10;
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.opacity = 1;
  }
  
  /**
   * Hide tooltip
   */
  function hideTooltip() {
    tooltip.style.opacity = 0;
  }
  
  /**
   * Create legend element
   * @returns {HTMLElement} - Legend element
   */
  function createLegend() {
    const legendElement = document.createElement('div');
    legendElement.className = 'alejo-chart-legend';
    Object.assign(legendElement.style, {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      padding: '10px',
      fontSize: '12px'
    });
    
    return legendElement;
  }
  
  /**
   * Update legend
   */
  function updateLegend() {
    const legendElement = container.querySelector('.alejo-chart-legend');
    if (!legendElement) return;
    
    legendElement.innerHTML = '';
    
    config.lines.forEach((line, index) => {
      const item = document.createElement('div');
      item.className = 'alejo-chart-legend-item';
      Object.assign(item.style, {
        display: 'flex',
        alignItems: 'center',
        marginRight: '15px',
        marginBottom: '5px',
        cursor: 'pointer'
      });
      
      const color = document.createElement('div');
      color.className = 'alejo-chart-legend-color';
      Object.assign(color.style, {
        width: '12px',
        height: '12px',
        backgroundColor: line.color || getColor(index),
        marginRight: '5px'
      });
      
      const label = document.createElement('span');
      label.textContent = line.label || `Series ${index + 1}`;
      
      item.appendChild(color);
      item.appendChild(label);
      legendElement.appendChild(item);
      
      // Add toggle functionality
      item.addEventListener('click', () => {
        line.visible = line.visible === undefined ? false : !line.visible;
        color.style.opacity = line.visible === false ? 0.3 : 1;
        label.style.opacity = line.visible === false ? 0.3 : 1;
        draw();
      });
    });
  }
  
  /**
   * Create statistics panel
   * @returns {HTMLElement} - Statistics panel
   */
  function createStatisticsPanel() {
    const statsElement = document.createElement('div');
    statsElement.className = 'alejo-chart-statistics';
    Object.assign(statsElement.style, {
      marginTop: '10px',
      padding: '10px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
      fontSize: '12px'
    });
    
    return statsElement;
  }
  
  /**
   * Update statistics panel
   */
  function updateStatistics() {
    const statsElement = container.querySelector('.alejo-chart-statistics');
    if (!statsElement) return;
    
    statsElement.innerHTML = '';
    
    config.lines.forEach((line, index) => {
      if (!line.data || line.data.length === 0) return;
      
      const values = line.data.map(d => d.y);
      const stats = calculateStatistics(values);
      
      const lineStats = document.createElement('div');
      lineStats.className = 'alejo-chart-line-statistics';
      Object.assign(lineStats.style, {
        marginBottom: '10px'
      });
      
      const header = document.createElement('div');
      header.innerHTML = `<strong>${line.label || `Series ${index + 1}`}</strong>`;
      Object.assign(header.style, {
        marginBottom: '5px',
        color: line.color || getColor(index)
      });
      
      const table = document.createElement('table');
      Object.assign(table.style, {
        width: '100%',
        borderCollapse: 'collapse'
      });
      
      table.innerHTML = `
        <tr>
          <td>Min</td>
          <td>${formatValue(stats.min, line.valueType || 'number')}</td>
          <td>Max</td>
          <td>${formatValue(stats.max, line.valueType || 'number')}</td>
        </tr>
        <tr>
          <td>Mean</td>
          <td>${formatValue(stats.mean, line.valueType || 'number')}</td>
          <td>Median</td>
          <td>${formatValue(stats.median, line.valueType || 'number')}</td>
        </tr>
        <tr>
          <td>Std Dev</td>
          <td>${formatValue(stats.stdDev, line.valueType || 'number')}</td>
          <td>P95</td>
          <td>${formatValue(stats.percentile95, line.valueType || 'number')}</td>
        </tr>
      `;
      
      lineStats.appendChild(header);
      lineStats.appendChild(table);
      statsElement.appendChild(lineStats);
    });
  }
  
  /**
   * Generate line path
   * @param {Array} data - Line data
   * @returns {string} - SVG path string
   */
  function generateLinePath(data) {
    if (!data || data.length === 0) return '';
    
    return data.reduce((path, point, index) => {
      const x = xScale(point.x);
      const y = yScale(point.y);
      const command = index === 0 ? 'M' : 'L';
      return path + `${command}${x},${y}`;
    }, '');
  }
  
  /**
   * Generate tick values
   * @param {Function} scale - Scale function
   * @param {number} count - Number of ticks
   * @returns {Array} - Tick values
   */
  function generateTickValues(scale, count) {
    const domain = scale.domain ? scale.domain() : [0, 1];
    const range = [];
    
    for (let i = 0; i < count; i++) {
      const value = domain[0] + (domain[1] - domain[0]) * (i / (count - 1));
      range.push(value);
    }
    
    return range;
  }
  
  /**
   * Get color for line
   * @param {number} index - Line index
   * @returns {string} - Color
   */
  function getColor(index) {
    const colors = [
      '#4285F4', // blue
      '#EA4335', // red
      '#FBBC05', // yellow
      '#34A853', // green
      '#8AB4F8', // light blue
      '#F6AEA9', // light red
      '#FDE293', // light yellow
      '#A8DAB5'  // light green
    ];
    
    return colors[index % colors.length];
  }
  
  // Public API
  const api = {
    /**
     * Update chart data
     * @param {Array} lines - Line data
     * @returns {Object} - Chart API
     */
    updateData(lines) {
      config.lines = lines;
      draw();
      return api;
    },
    
    /**
     * Add data point to a line
     * @param {number} lineIndex - Line index
     * @param {Object} point - Data point
     * @returns {Object} - Chart API
     */
    addDataPoint(lineIndex, point) {
      if (lineIndex >= 0 && lineIndex < config.lines.length) {
        config.lines[lineIndex].data.push(point);
        draw();
      }
      return api;
    },
    
    /**
     * Update chart configuration
     * @param {Object} options - Chart options
     * @returns {Object} - Chart API
     */
    updateConfig(options) {
      Object.assign(config, options);
      draw();
      return api;
    },
    
    /**
     * Resize chart
     * @param {number} width - New width
     * @param {number} height - New height
     * @returns {Object} - Chart API
     */
    resize(width, height) {
      config.width = width;
      config.height = height;
      
      // Update container size
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      
      // Update chart dimensions
      chartWidth = width - config.margin.left - config.margin.right;
      chartHeight = height - config.margin.top - config.margin.bottom;
      
      // Update SVG size
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      
      // Redraw chart
      draw();
      
      return api;
    },
    
    /**
     * Get chart configuration
     * @returns {Object} - Chart configuration
     */
    getConfig() {
      return { ...config };
    },
    
    /**
     * Destroy chart
     */
    destroy() {
      if (container) {
        container.innerHTML = '';
      }
    }
  };
  
  // Initialize and return API
  return initialize();
}
