/**
 * @file threshold-visualization.js
 * @description Visualization components for resource thresholds in the ALEJO monitoring dashboard
 * @module core/system/dashboard/threshold-visualization
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../../event-bus.js';
import { Logger } from '../../logger.js';

// Logger instance
const logger = new Logger('ThresholdVisualization');

/**
 * Create a gauge visualization for a resource with threshold indicators
 * @param {Object} options - Gauge options
 * @param {string} options.id - Unique ID for the gauge
 * @param {string} options.resourceName - Name of the resource (cpu, memory, etc)
 * @param {number} options.currentValue - Current resource value
 * @param {number} options.maxValue - Maximum resource value
 * @param {number} options.warningThreshold - Warning threshold value
 * @param {number} options.criticalThreshold - Critical threshold value
 * @param {string} options.unit - Unit of measurement (%, MB, °C)
 * @param {boolean} options.animated - Whether to animate the gauge
 * @returns {HTMLElement} The gauge element
 */
export function createThresholdGauge(options) {
  const {
    id,
    resourceName,
    currentValue,
    maxValue = 100,
    warningThreshold,
    criticalThreshold,
    unit = '%',
    animated = true
  } = options;
  
  // Create container
  const container = document.createElement('div');
  container.id = id;
  container.className = 'threshold-gauge-container';
  
  // Calculate percentage
  const percentage = Math.min(100, Math.max(0, (currentValue / maxValue) * 100));
  
  // Determine status class
  let statusClass = 'normal';
  if (currentValue >= criticalThreshold) {
    statusClass = 'critical';
  } else if (currentValue >= warningThreshold) {
    statusClass = 'warning';
  }
  
  // Create the gauge HTML
  container.innerHTML = `
    <div class="threshold-gauge ${statusClass}" role="meter" aria-valuemin="0" 
         aria-valuemax="${maxValue}" aria-valuenow="${currentValue}" 
         aria-label="${resourceName} usage: ${currentValue}${unit} out of ${maxValue}${unit}">
      <div class="threshold-gauge-title">
        <span class="resource-name">${resourceName}</span>
        <span class="resource-value">${currentValue}${unit}</span>
      </div>
      <div class="threshold-gauge-bar">
        <div class="threshold-gauge-fill ${animated ? 'animated' : ''}" style="width: ${percentage}%"></div>
        <div class="threshold-marker warning-marker" style="left: ${(warningThreshold / maxValue) * 100}%"></div>
        <div class="threshold-marker critical-marker" style="left: ${(criticalThreshold / maxValue) * 100}%"></div>
      </div>
      <div class="threshold-gauge-labels">
        <span class="min-label">0${unit}</span>
        <span class="warning-label">${warningThreshold}${unit}</span>
        <span class="critical-label">${criticalThreshold}${unit}</span>
        <span class="max-label">${maxValue}${unit}</span>
      </div>
    </div>
  `;
  
  return container;
}

/**
 * Create a detailed threshold card with multiple metrics
 * @param {Object} options - Card options
 * @param {string} options.id - Unique ID for the card
 * @param {string} options.title - Card title
 * @param {string} options.resourceType - Type of resource (cpu, memory, etc)
 * @param {Object} options.metrics - Resource metrics
 * @param {Object} options.thresholds - Resource thresholds
 * @returns {HTMLElement} The card element
 */
export function createThresholdCard(options) {
  const {
    id,
    title,
    resourceType,
    metrics,
    thresholds
  } = options;
  
  // Create container
  const container = document.createElement('div');
  container.id = id;
  container.className = 'threshold-card';
  container.setAttribute('data-resource-type', resourceType);
  
  // Create header
  const header = document.createElement('div');
  header.className = 'threshold-card-header';
  
  const titleElem = document.createElement('h3');
  titleElem.className = 'threshold-card-title';
  titleElem.textContent = title;
  
  const status = document.createElement('div');
  status.className = 'threshold-status';
  
  // Determine status based on current metrics vs thresholds
  let statusClass = 'normal';
  let statusText = 'Normal';
  
  if (metrics.value >= thresholds.critical) {
    statusClass = 'critical';
    statusText = 'Critical';
  } else if (metrics.value >= thresholds.warning) {
    statusClass = 'warning';
    statusText = 'Warning';
  }
  
  status.className = `threshold-status ${statusClass}`;
  status.textContent = statusText;
  
  header.appendChild(titleElem);
  header.appendChild(status);
  
  // Create gauge
  const gaugeOptions = {
    id: `${id}-gauge`,
    resourceName: resourceType,
    currentValue: metrics.value,
    maxValue: metrics.maxValue || 100,
    warningThreshold: thresholds.warning,
    criticalThreshold: thresholds.critical,
    unit: metrics.unit || '%'
  };
  
  const gauge = createThresholdGauge(gaugeOptions);
  
  // Create metrics table
  const metricsTable = document.createElement('table');
  metricsTable.className = 'threshold-metrics-table';
  metricsTable.innerHTML = `
    <tr>
      <th>Current</th>
      <th>Average</th>
      <th>Warning</th>
      <th>Critical</th>
    </tr>
    <tr>
      <td>${metrics.value}${metrics.unit || '%'}</td>
      <td>${metrics.average || '-'}${metrics.unit || '%'}</td>
      <td>${thresholds.warning}${metrics.unit || '%'}</td>
      <td>${thresholds.critical}${metrics.unit || '%'}</td>
    </tr>
  `;
  
  // Create thresholds control
  const thresholdControls = document.createElement('div');
  thresholdControls.className = 'threshold-controls';
  thresholdControls.innerHTML = `
    <button class="threshold-btn configure-btn" data-resource="${resourceType}">
      Configure Thresholds
    </button>
    <button class="threshold-btn reset-btn" data-resource="${resourceType}">
      Reset to Default
    </button>
  `;
  
  // Assemble the card
  container.appendChild(header);
  container.appendChild(gauge);
  container.appendChild(metricsTable);
  container.appendChild(thresholdControls);
  
  return container;
}

/**
 * Create a threshold timeline visualization
 * @param {Object} options - Timeline options
 * @param {string} options.id - Unique ID for the timeline
 * @param {string} options.resourceType - Type of resource
 * @param {Array} options.timeSeriesData - Time series data points
 * @param {number} options.warningThreshold - Warning threshold
 * @param {number} options.criticalThreshold - Critical threshold
 * @returns {HTMLElement} The timeline element
 */
export function createThresholdTimeline(options) {
  const {
    id,
    resourceType,
    timeSeriesData,
    warningThreshold,
    criticalThreshold
  } = options;
  
  // Create container
  const container = document.createElement('div');
  container.id = id;
  container.className = 'threshold-timeline';
  container.setAttribute('data-resource-type', resourceType);
  
  // Create canvas for drawing the chart
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 200;
  canvas.setAttribute('aria-label', `${resourceType} usage timeline chart with thresholds`);
  
  container.appendChild(canvas);
  
  // Add legend
  const legend = document.createElement('div');
  legend.className = 'threshold-timeline-legend';
  legend.innerHTML = `
    <div class="legend-item">
      <span class="legend-color normal"></span>
      <span class="legend-label">Normal</span>
    </div>
    <div class="legend-item">
      <span class="legend-color warning"></span>
      <span class="legend-label">Warning (${warningThreshold}+)</span>
    </div>
    <div class="legend-item">
      <span class="legend-color critical"></span>
      <span class="legend-label">Critical (${criticalThreshold}+)</span>
    </div>
  `;
  
  container.appendChild(legend);
  
  // Add accessible data table for screen readers
  const dataTable = document.createElement('table');
  dataTable.className = 'sr-only';
  dataTable.setAttribute('aria-label', `${resourceType} usage data table`);
  
  let tableHTML = `
    <thead>
      <tr>
        <th>Time</th>
        <th>Value</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
  `;
  
  if (timeSeriesData && timeSeriesData.length) {
    timeSeriesData.forEach(point => {
      const time = new Date(point.timestamp).toLocaleTimeString();
      const value = point.value;
      let status = 'Normal';
      
      if (value >= criticalThreshold) {
        status = 'Critical';
      } else if (value >= warningThreshold) {
        status = 'Warning';
      }
      
      tableHTML += `
        <tr>
          <td>${time}</td>
          <td>${value}</td>
          <td>${status}</td>
        </tr>
      `;
    });
  }
  
  tableHTML += '</tbody>';
  dataTable.innerHTML = tableHTML;
  
  container.appendChild(dataTable);
  
  // If we have data and the canvas context, draw the chart
  if (timeSeriesData && timeSeriesData.length && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    drawTimelineChart(ctx, timeSeriesData, warningThreshold, criticalThreshold);
  }
  
  return container;
}

/**
 * Draw the timeline chart on a canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} data - Time series data
 * @param {number} warningThreshold - Warning threshold
 * @param {number} criticalThreshold - Critical threshold
 * @private
 */
function drawTimelineChart(ctx, data, warningThreshold, criticalThreshold) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const padding = 30;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);
  
  // Draw threshold lines
  const maxValue = Math.max(...data.map(p => p.value), criticalThreshold) * 1.1;
  
  // Warning threshold line
  const warningY = height - padding - ((warningThreshold / maxValue) * (height - 2 * padding));
  ctx.strokeStyle = '#f6ad55';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(padding, warningY);
  ctx.lineTo(width - padding, warningY);
  ctx.stroke();
  
  // Critical threshold line
  const criticalY = height - padding - ((criticalThreshold / maxValue) * (height - 2 * padding));
  ctx.strokeStyle = '#f56565';
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(padding, criticalY);
  ctx.lineTo(width - padding, criticalY);
  ctx.stroke();
  
  // Reset line dash
  ctx.setLineDash([]);
  
  // Draw data points
  if (data.length > 1) {
    const timeRange = data[data.length - 1].timestamp - data[0].timestamp;
    const pointSpacing = (width - 2 * padding) / (data.length - 1);
    
    // Draw line connecting points
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4299e1';
    
    data.forEach((point, index) => {
      const x = padding + (index * pointSpacing);
      const y = height - padding - ((point.value / maxValue) * (height - 2 * padding));
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw points with appropriate colors
    data.forEach((point, index) => {
      const x = padding + (index * pointSpacing);
      const y = height - padding - ((point.value / maxValue) * (height - 2 * padding));
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      
      if (point.value >= criticalThreshold) {
        ctx.fillStyle = '#f56565';
      } else if (point.value >= warningThreshold) {
        ctx.fillStyle = '#f6ad55';
      } else {
        ctx.fillStyle = '#4299e1';
      }
      
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    
    // Draw x and y axis
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw y-axis labels
    ctx.fillStyle = '#718096';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i <= 5; i++) {
      const value = (maxValue / 5) * i;
      const y = height - padding - ((value / maxValue) * (height - 2 * padding));
      
      ctx.fillText(value.toFixed(1), padding - 5, y);
    }
    
    // Draw x-axis time labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    for (let i = 0; i < data.length; i += Math.max(1, Math.floor(data.length / 5))) {
      const x = padding + (i * pointSpacing);
      const time = new Date(data[i].timestamp).toLocaleTimeString();
      
      ctx.fillText(time, x, height - padding + 5);
    }
  }
}

export default {
  createThresholdGauge,
  createThresholdCard,
  createThresholdTimeline
};
