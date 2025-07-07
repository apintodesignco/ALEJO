/**
 * ALEJO Initialization Log Viewer
 * 
 * This module provides a detailed view of the initialization process,
 * including component initialization order, timing, dependencies, and errors.
 * It helps users understand and troubleshoot the initialization process.
 */

import { getInitializationStatus } from './initialization-manager.js';
import { getErrorLog } from './error-handler.js';

// Store initialization logs
const initLogs = [];
const MAX_LOG_ENTRIES = 1000;

/**
 * Log an initialization event
 * 
 * @param {string} type - Event type (start, success, failure, retry, fallback)
 * @param {string} componentId - Component ID
 * @param {Object} details - Additional details
 */
export function logInitEvent(type, componentId, details = {}) {
  const timestamp = Date.now();
  const logEntry = {
    timestamp,
    type,
    componentId,
    details,
    formattedTime: new Date(timestamp).toISOString()
  };
  
  // Add to logs with size limit
  initLogs.unshift(logEntry);
  if (initLogs.length > MAX_LOG_ENTRIES) {
    initLogs.pop();
  }
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[INIT ${type.toUpperCase()}] ${componentId}`, details);
  }
}

/**
 * Get initialization logs
 * 
 * @param {Object} options - Filter options
 * @param {string} options.componentId - Filter by component ID
 * @param {string} options.type - Filter by event type
 * @param {number} options.limit - Limit number of results
 * @returns {Array} - Filtered logs
 */
export function getInitLogs(options = {}) {
  const { componentId, type, limit = 100 } = options;
  
  let filtered = [...initLogs];
  
  if (componentId) {
    filtered = filtered.filter(log => log.componentId === componentId);
  }
  
  if (type) {
    filtered = filtered.filter(log => log.type === type);
  }
  
  return filtered.slice(0, limit);
}

/**
 * Get initialization timeline data
 * 
 * @returns {Object} - Timeline data
 */
export function getInitializationTimeline() {
  const initStatus = getInitializationStatus();
  const errorLog = getErrorLog();
  
  // Extract component initialization times
  const componentTimes = {};
  
  // Process logs to build timeline
  initLogs.forEach(log => {
    const { timestamp, componentId, type } = log;
    
    if (!componentTimes[componentId]) {
      componentTimes[componentId] = {
        id: componentId,
        startTime: null,
        endTime: null,
        duration: null,
        status: 'unknown',
        events: []
      };
    }
    
    // Add event to component timeline
    componentTimes[componentId].events.push({
      type,
      timestamp,
      details: log.details
    });
    
    // Update component timing info
    if (type === 'start') {
      componentTimes[componentId].startTime = timestamp;
    } else if (type === 'success' || type === 'fallback') {
      componentTimes[componentId].endTime = timestamp;
      componentTimes[componentId].status = type === 'success' ? 'initialized' : 'fallback';
    } else if (type === 'failure' && !componentTimes[componentId].endTime) {
      componentTimes[componentId].endTime = timestamp;
      componentTimes[componentId].status = 'failed';
    }
  });
  
  // Calculate durations
  Object.values(componentTimes).forEach(component => {
    if (component.startTime && component.endTime) {
      component.duration = component.endTime - component.startTime;
    }
  });
  
  // Get component dependencies
  const componentDependencies = {};
  Object.entries(initStatus.componentStatus || {}).forEach(([id, status]) => {
    componentDependencies[id] = status.dependencies || [];
  });
  
  // Build timeline data
  return {
    startTime: initStatus.startTime,
    endTime: initStatus.endTime,
    totalDuration: initStatus.endTime ? initStatus.endTime - initStatus.startTime : null,
    components: Object.values(componentTimes),
    dependencies: componentDependencies,
    errors: errorLog.filter(error => error.context?.includes('initialization')),
    isComplete: !initStatus.isInitializing
  };
}

/**
 * Generate an HTML visualization of the initialization timeline
 * 
 * @returns {string} - HTML content
 */
export function generateTimelineVisualization() {
  const timeline = getInitializationTimeline();
  
  if (!timeline.startTime) {
    return '<div class="init-timeline-empty">No initialization data available</div>';
  }
  
  // Sort components by start time
  const sortedComponents = [...timeline.components].sort((a, b) => {
    // Components with no start time go last
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime - b.startTime;
  });
  
  // Calculate timeline scale
  const timelineStart = timeline.startTime;
  const timelineEnd = timeline.endTime || Date.now();
  const timelineDuration = timelineEnd - timelineStart;
  
  // Generate component rows
  const componentRows = sortedComponents.map(component => {
    const startOffset = component.startTime ? 
      ((component.startTime - timelineStart) / timelineDuration) * 100 : 0;
    
    const width = component.duration ? 
      (component.duration / timelineDuration) * 100 : 
      component.startTime ? 
        ((Date.now() - component.startTime) / timelineDuration) * 100 : 0;
    
    const statusClass = component.status === 'initialized' ? 'success' : 
                        component.status === 'fallback' ? 'fallback' : 
                        component.status === 'failed' ? 'failed' : 'pending';
    
    // Format duration
    const durationText = component.duration ? 
      `${component.duration}ms` : 
      component.startTime ? 'In progress' : 'Not started';
    
    return `
      <div class="timeline-row">
        <div class="timeline-label" title="${component.id}">
          ${component.id}
        </div>
        <div class="timeline-bar-container">
          <div class="timeline-bar ${statusClass}" 
               style="left: ${startOffset}%; width: ${width}%;"
               title="${component.id}: ${durationText}">
          </div>
        </div>
        <div class="timeline-duration">
          ${durationText}
        </div>
      </div>
    `;
  }).join('');
  
  // Generate timeline markers
  const markers = [];
  const markerCount = 5;
  for (let i = 0; i <= markerCount; i++) {
    const percentage = (i / markerCount) * 100;
    const time = timelineStart + (timelineDuration * (i / markerCount));
    const timeFromStart = time - timelineStart;
    markers.push(`
      <div class="timeline-marker" style="left: ${percentage}%">
        <div class="timeline-marker-line"></div>
        <div class="timeline-marker-label">${timeFromStart}ms</div>
      </div>
    `);
  }
  
  // Generate HTML
  return `
    <div class="init-timeline">
      <div class="timeline-header">
        <div>Component</div>
        <div>Initialization Timeline</div>
        <div>Duration</div>
      </div>
      
      <div class="timeline-markers-container">
        ${markers.join('')}
      </div>
      
      <div class="timeline-rows">
        ${componentRows}
      </div>
      
      <div class="timeline-summary">
        <div>Total Duration: ${timeline.totalDuration ? `${timeline.totalDuration}ms` : 'In progress'}</div>
        <div>Components: ${timeline.components.length}</div>
        <div>Errors: ${timeline.errors.length}</div>
      </div>
    </div>
  `;
}

/**
 * Get CSS styles for the timeline visualization
 * 
 * @returns {string} - CSS styles
 */
export function getTimelineStyles() {
  return `
    .init-timeline {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 12px;
      margin: 16px 0;
    }
    
    .init-timeline-empty {
      padding: 16px;
      text-align: center;
      color: #666;
    }
    
    .timeline-header {
      display: grid;
      grid-template-columns: 150px 1fr 80px;
      font-weight: 600;
      padding-bottom: 4px;
      border-bottom: 1px solid #eee;
    }
    
    .timeline-markers-container {
      position: relative;
      height: 20px;
      margin-left: 150px;
      margin-right: 80px;
    }
    
    .timeline-marker {
      position: absolute;
      top: 0;
      height: 100%;
    }
    
    .timeline-marker-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background-color: #eee;
    }
    
    .timeline-marker-label {
      position: absolute;
      top: 4px;
      left: 4px;
      font-size: 10px;
      color: #999;
    }
    
    .timeline-rows {
      max-height: 300px;
      overflow-y: auto;
    }
    
    .timeline-row {
      display: grid;
      grid-template-columns: 150px 1fr 80px;
      height: 24px;
      align-items: center;
      border-bottom: 1px solid #f5f5f5;
    }
    
    .timeline-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 8px;
    }
    
    .timeline-bar-container {
      position: relative;
      height: 12px;
    }
    
    .timeline-bar {
      position: absolute;
      height: 100%;
      border-radius: 2px;
    }
    
    .timeline-bar.success {
      background-color: #4caf50;
    }
    
    .timeline-bar.fallback {
      background-color: #ff9800;
    }
    
    .timeline-bar.failed {
      background-color: #f44336;
    }
    
    .timeline-bar.pending {
      background-color: #2196f3;
      background-image: linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.15) 25%,
        transparent 25%,
        transparent 50%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 255, 255, 0.15) 75%,
        transparent 75%,
        transparent
      );
      background-size: 1rem 1rem;
      animation: timeline-progress 1s linear infinite;
    }
    
    .timeline-duration {
      text-align: right;
      padding-right: 8px;
      color: #666;
    }
    
    .timeline-summary {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #eee;
      color: #666;
    }
    
    @keyframes timeline-progress {
      0% {
        background-position: 1rem 0;
      }
      100% {
        background-position: 0 0;
      }
    }
    
    /* High contrast mode support */
    @media (forced-colors: active) {
      .timeline-bar.success {
        border: 1px solid currentColor;
      }
      .timeline-bar.fallback {
        border: 1px solid currentColor;
      }
      .timeline-bar.failed {
        border: 1px solid currentColor;
      }
      .timeline-bar.pending {
        border: 1px solid currentColor;
      }
    }
  `;
}
