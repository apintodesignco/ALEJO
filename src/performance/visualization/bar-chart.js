/**
 * @file bar-chart.js
 * @description A reusable bar chart component for visualizing comparative performance metrics
 * @module performance/visualization/bar-chart
 */

import * as VisCore from './visualization-core.js';
import { EventBus } from '../../core/event-bus.js';

/**
 * @class BarChart
 * @description A reusable bar chart component for visualizing comparative performance metrics
 */
export class BarChart {
  /**
   * @constructor
   * @param {Object} config - Configuration object for the bar chart
   */
  constructor(config) {
    // Default configuration
    this.config = {
      containerId: 'bar-chart-container',
      width: 600,
      height: 400,
      margin: { top: 40, right: 30, bottom: 60, left: 60 },
      barPadding: 0.2,
      colorScheme: 'performance',
      showValues: true,
      showLegend: true,
      horizontal: false,
      animate: true,
      sortBars: false,
      tooltip: {
        enabled: true,
        formatter: null
      },
      accessibility: {
        enabled: true,
        ariaLabel: 'Performance bar chart',
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
    
    // Create chart group with margins
    this.chart = this.svg.append('g')
      .attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`)
      .attr('class', 'alejo-bar-chart');
      
    // Create axes groups
    this.xAxisGroup = this.chart.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.config.height - this.config.margin.top - this.config.margin.bottom})`);
      
    this.yAxisGroup = this.chart.append('g')
      .attr('class', 'y-axis');
      
    // Create title
    if (this.config.title) {
      this.titleElement = this.svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', this.config.width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
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
  }

  /**
   * Set up event listeners for the chart
   * @private
   */
  setupEventListeners() {
    // Window resize event for responsiveness
    window.addEventListener('resize', this.debounce(() => {
      if (this.data) {
        this.updateDimensions();
        this.render(this.data);
      }
    }, 250));
    
    // Subscribe to performance events if needed
    if (this.config.subscribeToEvents) {
      EventBus.subscribe('performance:data:updated', (data) => {
        if (data && data.type === this.config.dataType) {
          this.update(data.metrics);
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
    
    // Update inner dimensions
    this.innerWidth = this.config.width - this.config.margin.left - this.config.margin.right;
    this.innerHeight = this.config.height - this.config.margin.top - this.config.margin.bottom;
  }

  /**
   * Render the bar chart with the provided data
   * @public
   * @param {Array} data - Array of data objects to visualize
   */
  render(data) {
    if (!data || !data.length) {
      console.warn('No data provided to render bar chart');
      return;
    }
    
    this.data = data;
    this.updateDimensions();
    
    // Sort data if configured
    if (this.config.sortBars) {
      this.data = [...this.data].sort((a, b) => {
        return this.config.sortAscending 
          ? a[this.config.valueKey] - b[this.config.valueKey]
          : b[this.config.valueKey] - a[this.config.valueKey];
      });
    }
    
    // Set up scales
    this.setupScales();
    
    // Draw axes
    this.drawAxes();
    
    // Draw bars
    this.drawBars();
    
    // Add labels if configured
    if (this.config.showValues) {
      this.addValueLabels();
    }
    
    // Add legend if configured
    if (this.config.showLegend) {
      this.drawLegend();
    }
    
    // Add accessibility features
    if (this.config.accessibility.enabled) {
      this.addAccessibilityFeatures();
    }
    
    // Emit render complete event
    this.emit('renderComplete', { chart: this, data: this.data });
  }

  /**
   * Set up scales for the chart based on data and configuration
   * @private
   */
  setupScales() {
    const valueExtent = VisCore.getDataExtent(this.data, this.config.valueKey);
    const categories = this.data.map(d => d[this.config.categoryKey]);
    
    if (this.config.horizontal) {
      // For horizontal bars
      this.xScale = VisCore.createLinearScale(
        [0, valueExtent[1]],
        [0, this.innerWidth]
      );
      
      this.yScale = VisCore.createCategoricalScale(
        categories,
        [0, this.innerHeight],
        this.config.barPadding
      );
    } else {
      // For vertical bars
      this.xScale = VisCore.createCategoricalScale(
        categories,
        [0, this.innerWidth],
        this.config.barPadding
      );
      
      this.yScale = VisCore.createLinearScale(
        [valueExtent[1], 0], // Inverted for SVG
        [0, this.innerHeight]
      );
    }
    
    // Set up color scale
    this.colorScale = VisCore.createColorScale(
      categories,
      this.config.colorScheme
    );
  }

  /**
   * Draw the X and Y axes
   * @private
   */
  drawAxes() {
    // Create X axis
    const xAxis = this.config.horizontal
      ? VisCore.createBottomAxis(this.xScale)
      : VisCore.createBottomAxis(this.xScale, this.data.length);

    // Create Y axis
    const yAxis = this.config.horizontal
      ? VisCore.createLeftAxis(this.yScale, this.data.length)
      : VisCore.createLeftAxis(this.yScale);

    // Render X axis with animation if enabled
    if (this.config.animate) {
      this.xAxisGroup.transition().duration(500).call(xAxis);
    } else {
      this.xAxisGroup.call(xAxis);
    }

    // Render Y axis with animation if enabled
    if (this.config.animate) {
      this.yAxisGroup.transition().duration(500).call(yAxis);
    } else {
      this.yAxisGroup.call(yAxis);
    }

    // Add X axis label if provided
    if (this.config.xAxisLabel) {
      // Remove existing label if any
      this.svg.select('.x-axis-label').remove();
      
      this.svg.append('text')
        .attr('class', 'x-axis-label')
        .attr('x', this.config.width / 2)
        .attr('y', this.config.height - 10)
        .attr('text-anchor', 'middle')
        .text(this.config.xAxisLabel);
    }

    // Add Y axis label if provided
    if (this.config.yAxisLabel) {
      // Remove existing label if any
      this.svg.select('.y-axis-label').remove();
      
      this.svg.append('text')
        .attr('class', 'y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -this.config.height / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .text(this.config.yAxisLabel);
    }
    
    // Style axes
    this.svg.selectAll('.domain').attr('stroke', '#ccc');
    this.svg.selectAll('.tick line').attr('stroke', '#ccc');
    this.svg.selectAll('.tick text')
      .attr('fill', '#666')
      .attr('font-size', '12px');
  }

  /**
   * Draw the bars based on the data
   * @private
   */
  drawBars() {
    // Select all existing bars
    const bars = this.chart.selectAll('.bar')
      .data(this.data, (d, i) => d[this.config.categoryKey] || i);
    
    // Remove bars that no longer have data
    bars.exit()
      .transition()
      .duration(this.config.animate ? 500 : 0)
      .attr(this.config.horizontal ? 'width' : 'height', 0)
      .remove();
    
    // Add new bars
    const newBars = bars.enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('fill', (d) => this.colorScale(d[this.config.categoryKey]))
      .attr('stroke', (d) => VisCore.darkenColor(this.colorScale(d[this.config.categoryKey]), 0.2))
      .attr('stroke-width', 1)
      .attr('rx', 2) // Rounded corners
      .attr('ry', 2)
      .style('cursor', this.config.onBarClick ? 'pointer' : 'default')
      .attr('role', 'graphics-symbol')
      .attr('aria-roledescription', 'bar')
      .attr('tabindex', 0)
      .each((d, i, nodes) => {
        const bar = nodes[i];
        const value = d[this.config.valueKey];
        const category = d[this.config.categoryKey];
        
        // Set ARIA attributes for accessibility
        bar.setAttribute('aria-label', `${category}: ${value}`);
      });
      
    if (this.config.horizontal) {
      // Position horizontal bars
      newBars
        .attr('x', 0)
        .attr('y', (d) => this.yScale(d[this.config.categoryKey]))
        .attr('height', this.yScale.bandwidth())
        .attr('width', 0); // Start with zero width for animation
    } else {
      // Position vertical bars
      newBars
        .attr('x', (d) => this.xScale(d[this.config.categoryKey]))
        .attr('y', this.innerHeight)
        .attr('width', this.xScale.bandwidth())
        .attr('height', 0); // Start with zero height for animation
    }
    
    // Merge new and existing bars
    const allBars = newBars.merge(bars);
    
    // Add event handlers
    if (this.config.onBarClick) {
      allBars.on('click', (event, d) => {
        this.config.onBarClick(d, event);
      });
    }
    
    // Add hover effects
    allBars
      .on('mouseenter', (event, d) => {
        const bar = event.target;
        bar.setAttribute('fill-opacity', 0.8);
        this.showTooltip(event, d);
      })
      .on('mouseleave', (event) => {
        const bar = event.target;
        bar.setAttribute('fill-opacity', 1);
        this.hideTooltip();
      });
    
    // Animate bars to their proper dimensions
    if (this.config.horizontal) {
      allBars.transition()
        .duration(this.config.animate ? 800 : 0)
        .delay((d, i) => this.config.animate ? i * 50 : 0)
        .attr('x', 0)
        .attr('y', (d) => this.yScale(d[this.config.categoryKey]))
        .attr('width', (d) => this.xScale(d[this.config.valueKey]))
        .attr('height', this.yScale.bandwidth());
    } else {
      allBars.transition()
        .duration(this.config.animate ? 800 : 0)
        .delay((d, i) => this.config.animate ? i * 50 : 0)
        .attr('x', (d) => this.xScale(d[this.config.categoryKey]))
        .attr('y', (d) => this.yScale(d[this.config.valueKey]))
        .attr('width', this.xScale.bandwidth())
        .attr('height', (d) => this.innerHeight - this.yScale(d[this.config.valueKey]));
    }
  }

  /**
   * Add value labels to bars
   * @private
   */
  addValueLabels() {
    // Remove existing labels
    this.chart.selectAll('.bar-label').remove();
    
    // Create value formatter
    const formatValue = this.config.valueFormatter || VisCore.formatNumber;
    
    // Add labels
    const labels = this.chart.selectAll('.bar-label')
      .data(this.data)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .text(d => formatValue(d[this.config.valueKey]))
      .attr('text-anchor', this.config.horizontal ? 'start' : 'middle')
      .attr('fill', '#333')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none'); // Prevent labels from intercepting mouse events
    
    if (this.config.horizontal) {
      // Position labels for horizontal bars
      labels
        .attr('x', d => this.xScale(d[this.config.valueKey]) + 5) // 5px padding
        .attr('y', d => this.yScale(d[this.config.categoryKey]) + this.yScale.bandwidth() / 2)
        .attr('dominant-baseline', 'central');
    } else {
      // Position labels for vertical bars
      labels
        .attr('x', d => this.xScale(d[this.config.categoryKey]) + this.xScale.bandwidth() / 2)
        .attr('y', d => this.yScale(d[this.config.valueKey]) - 5) // 5px padding
        .attr('dominant-baseline', 'text-after-edge');
    }
    
    // Animate labels if animation is enabled
    if (this.config.animate) {
      labels
        .style('opacity', 0)
        .transition()
        .duration(800)
        .delay((d, i) => i * 50 + 400) // Start after bars animation
        .style('opacity', 1);
    }
  }

  /**
   * Draw the legend for the chart
   * @private
   */
  drawLegend() {
    // Remove existing legend
    this.svg.select('.legend').remove();
    
    // Create legend group
    const legend = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${this.config.width - this.config.margin.right - 100}, ${this.config.margin.top})`);
    
    // Get categories
    const categories = this.data.map(d => d[this.config.categoryKey]);
    
    // Add legend items
    const legendItems = legend.selectAll('.legend-item')
      .data(categories)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`);
    
    // Add color squares
    legendItems.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', d => this.colorScale(d));
    
    // Add text labels
    legendItems.append('text')
      .attr('x', 20)
      .attr('y', 10)
      .attr('font-size', '12px')
      .attr('fill', '#333')
      .text(d => d);
    
    // Add legend title if provided
    if (this.config.legendTitle) {
      legend.append('text')
        .attr('class', 'legend-title')
        .attr('x', 0)
        .attr('y', -10)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(this.config.legendTitle);
    }
    
    // Make legend interactive if needed
    if (this.config.interactiveLegend) {
      legendItems
        .style('cursor', 'pointer')
        .on('click', (event, category) => {
          // Toggle visibility of corresponding bars
          const bars = this.chart.selectAll('.bar')
            .filter(d => d[this.config.categoryKey] === category);
          
          const isVisible = !bars.classed('hidden');
          
          bars.classed('hidden', isVisible)
            .transition()
            .duration(500)
            .style('opacity', isVisible ? 0 : 1);
          
          // Update legend item appearance
          event.currentTarget.querySelector('rect')
            .setAttribute('fill-opacity', isVisible ? 0.3 : 1);
          
          // Emit event
          this.emit('legendToggle', { category, isVisible: !isVisible });
        });
    }
  }

  /**
   * Add accessibility features to the chart
   * @private
   */
  addAccessibilityFeatures() {
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
    const title = this.config.title || 'Bar chart';
    const categoryKey = this.config.categoryKey;
    const valueKey = this.config.valueKey;
    
    let description = `${title}. `;
    description += `This bar chart shows ${valueKey} values for different ${categoryKey} categories. `;
    
    // Add data summary
    if (this.data && this.data.length) {
      // Find highest and lowest values
      const sortedData = [...this.data].sort((a, b) => b[valueKey] - a[valueKey]);
      const highest = sortedData[0];
      const lowest = sortedData[sortedData.length - 1];
      
      description += `The highest value is ${highest[valueKey]} for ${highest[categoryKey]}. `;
      description += `The lowest value is ${lowest[valueKey]} for ${lowest[categoryKey]}. `;
      
      // Add average if relevant
      if (this.data.length > 2) {
        const sum = this.data.reduce((acc, d) => acc + d[valueKey], 0);
        const avg = sum / this.data.length;
        description += `The average value is ${VisCore.formatNumber(avg)}. `;
      }
    }
    
    // Set the description
    descElement.textContent = description;
    
    // Create data table for screen readers if configured
    if (this.config.accessibility.includeDataTable) {
      this.createAccessibleDataTable();
    }
    
    // Add keyboard navigation
    this.addKeyboardNavigation();
  }
  
  /**
   * Create an accessible data table for screen readers
   * @private
   */
  createAccessibleDataTable() {
    // Remove existing table if any
    const existingTable = document.getElementById(`${this.config.containerId}-data-table`);
    if (existingTable) {
      existingTable.remove();
    }
    
    // Create table element
    const table = document.createElement('table');
    table.id = `${this.config.containerId}-data-table`;
    table.className = 'sr-only'; // Screen reader only
    table.setAttribute('aria-label', `${this.config.title || 'Bar chart'} data table`);
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const categoryHeader = document.createElement('th');
    categoryHeader.textContent = this.config.categoryKey;
    headerRow.appendChild(categoryHeader);
    
    const valueHeader = document.createElement('th');
    valueHeader.textContent = this.config.valueKey;
    headerRow.appendChild(valueHeader);
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Add data rows
    this.data.forEach(d => {
      const row = document.createElement('tr');
      
      const categoryCell = document.createElement('td');
      categoryCell.textContent = d[this.config.categoryKey];
      row.appendChild(categoryCell);
      
      const valueCell = document.createElement('td');
      valueCell.textContent = d[this.config.valueKey];
      row.appendChild(valueCell);
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    this.container.appendChild(table);
  }
  
  /**
   * Add keyboard navigation to the chart
   * @private
   */
  addKeyboardNavigation() {
    // Get all bar elements
    const bars = this.chart.selectAll('.bar').nodes();
    
    // Add keyboard event listeners to each bar
    bars.forEach((bar, index) => {
      bar.addEventListener('keydown', (event) => {
        const key = event.key;
        
        // Handle arrow keys for navigation
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          // Move to next bar
          const nextIndex = (index + 1) % bars.length;
          bars[nextIndex].focus();
          event.preventDefault();
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          // Move to previous bar
          const prevIndex = (index - 1 + bars.length) % bars.length;
          bars[prevIndex].focus();
          event.preventDefault();
        } else if (key === 'Enter' || key === ' ') {
          // Activate bar (simulate click)
          if (this.config.onBarClick) {
            const d = this.data[index];
            this.config.onBarClick(d, event);
          }
          event.preventDefault();
        }
      });
    });
  }

  /**
   * Update the chart with new data
   * @public
   * @param {Array} newData - New data to visualize
   */
  update(newData) {
    if (!newData || !newData.length) return;
    
    this.data = newData;
    this.render(this.data);
  }
  
  /**
   * Show tooltip with data information
   * @private
   * @param {Event} event - Mouse event
   * @param {Object} data - Data object for the hovered bar
   */
  showTooltip(event, data) {
    if (!this.config.tooltip.enabled || !this.tooltip) return;
    
    // Format tooltip content
    let content;
    if (this.config.tooltip.formatter) {
      content = this.config.tooltip.formatter(data);
    } else {
      const category = data[this.config.categoryKey];
      const value = data[this.config.valueKey];
      const formattedValue = this.config.valueFormatter ? 
        this.config.valueFormatter(value) : 
        VisCore.formatNumber(value);
      
      content = `<strong>${category}</strong><br>${formattedValue}`;
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
    this.data = null;
  }
}
