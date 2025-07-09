/**
 * @file gauge-chart.js
 * @description A gauge chart component for visualizing single metric values with thresholds
 * @module performance/visualization/gauge-chart
 */

import * as VisCore from './visualization-core.js';
import { EventBus } from '../../core/event-bus.js';

/**
 * @class GaugeChart
 * @description A reusable gauge chart component for visualizing performance metrics with thresholds
 */
export class GaugeChart {
  /**
   * @constructor
   * @param {Object} config - Configuration object for the gauge chart
   */
  constructor(config) {
    // Default configuration
    this.config = {
      containerId: 'gauge-chart-container',
      width: 300,
      height: 300,
      minValue: 0,
      maxValue: 100,
      value: 0,
      title: '',
      units: '',
      thresholds: [
        { value: 60, color: '#5cb85c' }, // Green for good
        { value: 80, color: '#f0ad4e' }, // Yellow for warning
        { value: 100, color: '#d9534f' } // Red for critical
      ],
      animationDuration: 500,
      showValue: true,
      valueFormatter: null,
      showThresholdLabels: true,
      ringWidth: 30,
      startAngle: -90,
      endAngle: 90,
      tooltip: {
        enabled: true,
        formatter: null
      },
      accessibility: {
        enabled: true,
        ariaLabel: 'Performance gauge chart',
        includeDataTable: true
      },
      ...config
    };

    // Initialize chart elements
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) {
      console.error(`Container with ID ${this.config.containerId} not found`);
      return;
    }

    // Set up event handlers
    this.eventHandlers = {};
    
    // Initialize the chart
    this.initialize();
  }

  /**
   * Initialize the chart structure
   * @private
   */
  initialize() {
    // Clear any existing content
    this.container.innerHTML = '';
    
    // Create the chart container
    this.chartContainer = VisCore.createContainer(
      this.container,
      this.config.width,
      this.config.height,
      this.config.accessibility.ariaLabel
    );
    
    // Create SVG element
    this.svg = VisCore.createSVG(
      this.chartContainer, 
      this.config.width, 
      this.config.height
    );
    
    // Calculate inner dimensions
    this.updateDimensions();
    
    // Create chart group centered in SVG
    this.chart = this.svg.append('g')
      .attr('transform', `translate(${this.config.width / 2},${this.config.height / 2})`)
      .attr('class', 'alejo-gauge-chart');
    
    // Create title
    if (this.config.title) {
      this.titleElement = this.svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', this.config.width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .text(this.config.title);
    }
    
    // Create tooltip if enabled
    if (this.config.tooltip.enabled) {
      this.tooltip = this.chartContainer.append('div')
        .attr('class', 'alejo-chart-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background-color', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('pointer-events', 'none')
        .style('z-index', 100)
        .style('font-size', '12px');
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Draw the gauge background
    this.drawGaugeBackground();
  }

  /**
   * Set up event listeners for the chart
   * @private
   */
  setupEventListeners() {
    // Window resize event for responsiveness
    window.addEventListener('resize', this.debounce(() => {
      this.updateDimensions();
      this.render(this.config.value);
    }, 250));
    
    // Subscribe to performance events if needed
    if (this.config.subscribeToEvents) {
      EventBus.subscribe('performance:data:updated', (data) => {
        if (data && data.type === this.config.dataType) {
          this.update(data.value);
        }
      });
    }
  }

  /**
   * Debounce function to limit the rate at which a function is executed
   * @private
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Update chart dimensions based on container size
   * @private
   */
  updateDimensions() {
    const containerRect = this.container.getBoundingClientRect();
    
    if (containerRect.width > 0) {
      this.config.width = containerRect.width;
      this.svg.attr('width', this.config.width);
    }
    
    // Calculate radius
    this.radius = Math.min(this.config.width, this.config.height) / 2 - 10;
    
    // Calculate angles in radians
    this.startAngleRad = (this.config.startAngle * Math.PI) / 180;
    this.endAngleRad = (this.config.endAngle * Math.PI) / 180;
  }

  /**
   * Draw the gauge background with threshold zones
   * @private
   */
  drawGaugeBackground() {
    // Sort thresholds by value
    const sortedThresholds = [...this.config.thresholds].sort((a, b) => a.value - b.value);
    
    // Create arc generator
    const arc = VisCore.createArc(
      this.radius - this.config.ringWidth,
      this.radius,
      this.startAngleRad,
      this.endAngleRad
    );
    
    // Draw background arc segments for each threshold
    let startValue = this.config.minValue;
    
    sortedThresholds.forEach((threshold, i) => {
      // Calculate end angle for this segment
      const endValue = threshold.value;
      const startAngle = this.startAngleRad + (this.endAngleRad - this.startAngleRad) * 
        ((startValue - this.config.minValue) / (this.config.maxValue - this.config.minValue));
      const endAngle = this.startAngleRad + (this.endAngleRad - this.startAngleRad) * 
        ((endValue - this.config.minValue) / (this.config.maxValue - this.config.minValue));
      
      // Create arc path
      const segmentArc = VisCore.createArc(
        this.radius - this.config.ringWidth,
        this.radius,
        startAngle,
        endAngle
      );
      
      // Draw the arc
      this.chart.append('path')
        .attr('class', 'gauge-bg-segment')
        .attr('d', segmentArc)
        .attr('fill', threshold.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
      
      // Add threshold labels if enabled
      if (this.config.showThresholdLabels) {
        // Position at the middle of the segment
        const labelAngle = (startAngle + endAngle) / 2;
        const labelRadius = this.radius + 15; // Slightly outside the gauge
        
        const x = Math.cos(labelAngle) * labelRadius;
        const y = Math.sin(labelAngle) * labelRadius;
        
        this.chart.append('text')
          .attr('class', 'threshold-label')
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', '12px')
          .attr('fill', '#666')
          .text(threshold.value);
      }
      
      // Update start value for next segment
      startValue = endValue;
    });
    
    // Draw gauge outline
    this.chart.append('path')
      .attr('class', 'gauge-outline')
      .attr('d', arc)
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);
    
    // Draw min/max labels
    this.chart.append('text')
      .attr('class', 'min-label')
      .attr('x', Math.cos(this.startAngleRad) * (this.radius + 15))
      .attr('y', Math.sin(this.startAngleRad) * (this.radius + 15))
      .attr('text-anchor', this.startAngleRad < -Math.PI/2 ? 'end' : 'start')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text(this.config.minValue);
    
    this.chart.append('text')
      .attr('class', 'max-label')
      .attr('x', Math.cos(this.endAngleRad) * (this.radius + 15))
      .attr('y', Math.sin(this.endAngleRad) * (this.radius + 15))
      .attr('text-anchor', this.endAngleRad > Math.PI/2 ? 'end' : 'start')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text(this.config.maxValue);
  }

  /**
   * Draw the gauge needle pointing to the current value
   * @private
   * @param {number} value - The value to point to
   */
  drawNeedle(value) {
    // Remove existing needle
    this.chart.selectAll('.gauge-needle').remove();
    
    // Calculate needle angle based on value
    const needleAngle = this.startAngleRad + (this.endAngleRad - this.startAngleRad) * 
      ((value - this.config.minValue) / (this.config.maxValue - this.config.minValue));
    
    // Calculate needle points
    const needleLength = this.radius - 10;
    const needleBaseWidth = 8;
    
    // Create needle shape
    const needleGroup = this.chart.append('g')
      .attr('class', 'gauge-needle')
      .attr('transform', `rotate(${needleAngle * 180 / Math.PI})`);
    
    // Draw needle
    needleGroup.append('path')
      .attr('d', `M 0 -${needleBaseWidth/2} L ${needleLength} 0 L 0 ${needleBaseWidth/2} Z`)
      .attr('fill', '#444')
      .attr('stroke', '#444')
      .attr('stroke-width', 1);
    
    // Add center circle
    needleGroup.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', needleBaseWidth)
      .attr('fill', '#666')
      .attr('stroke', '#444')
      .attr('stroke-width', 1);
    
    // Animate needle if configured
    if (this.config.animationDuration > 0) {
      needleGroup.style('transform-origin', '0 0')
        .style('transform', 'rotate(0deg)')
        .transition()
        .duration(this.config.animationDuration)
        .style('transform', `rotate(${needleAngle * 180 / Math.PI}deg)`);
    }
  }

  /**
   * Draw the value display in the center of the gauge
   * @private
   * @param {number} value - The value to display
   */
  drawValueDisplay(value) {
    // Remove existing value display
    this.chart.selectAll('.gauge-value').remove();
    
    if (!this.config.showValue) return;
    
    // Format the value
    const formattedValue = this.config.valueFormatter ? 
      this.config.valueFormatter(value) : 
      VisCore.formatNumber(value);
    
    // Add value text
    this.chart.append('text')
      .attr('class', 'gauge-value')
      .attr('x', 0)
      .attr('y', this.radius / 2) // Position below center
      .attr('text-anchor', 'middle')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text(formattedValue);
    
    // Add units if specified
    if (this.config.units) {
      this.chart.append('text')
        .attr('class', 'gauge-units')
        .attr('x', 0)
        .attr('y', this.radius / 2 + 25) // Position below value
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#666')
        .text(this.config.units);
    }
  }

  /**
   * Get the color for a specific value based on thresholds
   * @private
   * @param {number} value - The value to get color for
   * @returns {string} - The color for the value
   */
  getColorForValue(value) {
    // Sort thresholds by value (ascending)
    const sortedThresholds = [...this.config.thresholds].sort((a, b) => a.value - b.value);
    
    // Find the appropriate threshold
    for (const threshold of sortedThresholds) {
      if (value <= threshold.value) {
        return threshold.color;
      }
    }
    
    // If no threshold matches (value > max threshold), return the last color
    return sortedThresholds[sortedThresholds.length - 1].color;
  }

  /**
   * Add accessibility features to the chart
   * @private
   * @param {number} value - The current value
   */
  addAccessibilityFeatures(value) {
    // Add ARIA description
    this.svg.attr('aria-describedby', `${this.config.containerId}-description`);
    
    // Add description element if it doesn't exist
    let descElement = document.getElementById(`${this.config.containerId}-description`);
    
    if (!descElement) {
      descElement = document.createElement('div');
      descElement.id = `${this.config.containerId}-description`;
      descElement.className = 'sr-only'; // Screen reader only
      this.container.appendChild(descElement);
    }
    
    // Create descriptive text for screen readers
    const title = this.config.title || 'Gauge chart';
    
    let description = `${title}. `;
    description += `Current value is ${value} ${this.config.units} out of a maximum of ${this.config.maxValue} ${this.config.units}. `;
    
    // Add threshold information
    if (this.config.thresholds.length > 0) {
      description += 'Thresholds: ';
      
      this.config.thresholds.forEach((threshold, i) => {
        if (i > 0) description += ', ';
        description += `${threshold.value} ${this.config.units}`;
      });
      
      // Add current status
      const color = this.getColorForValue(value);
      const matchingThreshold = this.config.thresholds.find(t => t.color === color);
      
      if (matchingThreshold) {
        const thresholdIndex = this.config.thresholds.indexOf(matchingThreshold);
        const statusLabels = ['Good', 'Warning', 'Critical'];
        
        if (thresholdIndex < statusLabels.length) {
          description += `. Current status: ${statusLabels[thresholdIndex]}.`;
        }
      }
    }
    
    // Set the description
    descElement.textContent = description;
    
    // Create data table for screen readers if configured
    if (this.config.accessibility.includeDataTable) {
      this.createAccessibleDataTable(value);
    }
  }

  /**
   * Create an accessible data table for screen readers
   * @private
   * @param {number} value - The current value
   */
  createAccessibleDataTable(value) {
    // Remove existing table if any
    const existingTable = document.getElementById(`${this.config.containerId}-data-table`);
    if (existingTable) {
      existingTable.remove();
    }
    
    // Create table element
    const table = document.createElement('table');
    table.id = `${this.config.containerId}-data-table`;
    table.className = 'sr-only'; // Screen reader only
    table.setAttribute('aria-label', `${this.config.title || 'Gauge chart'} data table`);
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const metricHeader = document.createElement('th');
    metricHeader.textContent = 'Metric';
    headerRow.appendChild(metricHeader);
    
    const valueHeader = document.createElement('th');
    valueHeader.textContent = 'Value';
    headerRow.appendChild(valueHeader);
    
    const maxHeader = document.createElement('th');
    maxHeader.textContent = 'Maximum';
    headerRow.appendChild(maxHeader);
    
    const percentHeader = document.createElement('th');
    percentHeader.textContent = 'Percentage';
    headerRow.appendChild(percentHeader);
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    
    const metricCell = document.createElement('td');
    metricCell.textContent = this.config.title || 'Value';
    row.appendChild(metricCell);
    
    const valueCell = document.createElement('td');
    valueCell.textContent = `${value} ${this.config.units}`;
    row.appendChild(valueCell);
    
    const maxCell = document.createElement('td');
    maxCell.textContent = `${this.config.maxValue} ${this.config.units}`;
    row.appendChild(maxCell);
    
    const percentCell = document.createElement('td');
    const percentage = ((value - this.config.minValue) / (this.config.maxValue - this.config.minValue) * 100).toFixed(1);
    percentCell.textContent = `${percentage}%`;
    row.appendChild(percentCell);
    
    tbody.appendChild(row);
    table.appendChild(tbody);
    
    this.container.appendChild(table);
  }

  /**
   * Show tooltip with data information
   * @private
   * @param {Event} event - Mouse event
   * @param {number} value - The current value
   */
  showTooltip(event, value) {
    if (!this.config.tooltip.enabled || !this.tooltip) return;
    
    // Format tooltip content
    let content;
    if (this.config.tooltip.formatter) {
      content = this.config.tooltip.formatter(value);
    } else {
      const formattedValue = this.config.valueFormatter ? 
        this.config.valueFormatter(value) : 
        VisCore.formatNumber(value);
      
      const percentage = ((value - this.config.minValue) / (this.config.maxValue - this.config.minValue) * 100).toFixed(1);
      
      content = `
        <strong>${this.config.title || 'Value'}</strong><br>
        ${formattedValue} ${this.config.units}<br>
        ${percentage}% of maximum
      `;
    }
    
    // Set tooltip content and position
    this.tooltip
      .html(content)
      .style('opacity', 0.9)
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 28}px`);
  }

  /**
   * Hide the tooltip
   * @private
   */
  hideTooltip() {
    if (!this.config.tooltip.enabled || !this.tooltip) return;
    
    this.tooltip.style('opacity', 0);
  }

  /**
   * Render the gauge chart with the provided value
   * @public
   * @param {number} value - Value to visualize
   */
  render(value) {
    // Clamp value to min/max range
    const clampedValue = Math.max(this.config.minValue, Math.min(this.config.maxValue, value));
    
    // Store the current value
    this.currentValue = clampedValue;
    
    // Update dimensions
    this.updateDimensions();
    
    // Clear existing gauge elements
    this.chart.selectAll('.gauge-needle, .gauge-value, .gauge-units').remove();
    
    // Redraw gauge background
    this.chart.selectAll('.gauge-bg-segment, .gauge-outline, .min-label, .max-label, .threshold-label').remove();
    this.drawGaugeBackground();
    
    // Draw needle
    this.drawNeedle(clampedValue);
    
    // Draw value display
    this.drawValueDisplay(clampedValue);
    
    // Add accessibility features
    if (this.config.accessibility.enabled) {
      this.addAccessibilityFeatures(clampedValue);
    }
    
    // Add event handlers
    this.chart.on('mouseenter', (event) => {
      this.showTooltip(event, clampedValue);
    })
    .on('mousemove', (event) => {
      this.showTooltip(event, clampedValue);
    })
    .on('mouseleave', () => {
      this.hideTooltip();
    });
    
    // Emit render complete event
    this.emit('renderComplete', { chart: this, value: clampedValue });
  }

  /**
   * Update the chart with a new value
   * @public
   * @param {number} newValue - New value to visualize
   */
  update(newValue) {
    if (newValue === undefined || newValue === null) return;
    
    this.render(newValue);
  }

  /**
   * Register an event handler
   * @public
   * @param {string} eventName - Name of the event
   * @param {Function} handler - Event handler function
   */
  on(eventName, handler) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(handler);
    return this;
  }

  /**
   * Emit an event
   * @private
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event data
   */
  emit(eventName, data) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(handler => handler(data));
    }
  }

  /**
   * Clean up resources used by the chart
   * @public
   */
  destroy() {
    // Remove event listeners
    window.removeEventListener('resize', this.debounce);
    
    // Unsubscribe from events
    if (this.config.subscribeToEvents) {
      EventBus.unsubscribe('performance:data:updated');
    }
    
    // Remove DOM elements
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    // Clear references
    this.svg = null;
    this.chart = null;
  }
}
