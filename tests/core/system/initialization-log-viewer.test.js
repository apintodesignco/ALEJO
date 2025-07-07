/**
 * Initialization Log Viewer Test Suite
 * 
 * Tests the functionality of the initialization log viewer including:
 * - Event logging
 * - Log retrieval and filtering
 * - Timeline visualization generation
 * - CSS style generation
 */

import { 
  logInitEvent,
  getInitLogs,
  getFilteredLogs,
  generateTimelineData,
  generateTimelineVisualization,
  getTimelineStyles
} from '../../../src/core/system/initialization-log-viewer.js';

describe('Initialization Log Viewer', () => {
  // Reset state before each test
  beforeEach(() => {
    // Clear logs by resetting the module
    jest.resetModules();
  });

  describe('Event Logging', () => {
    test('should log initialization events with correct structure', () => {
      // Arrange
      const startEvent = {
        type: 'start',
        componentId: 'test.component',
        timestamp: Date.now(),
        details: { priority: 100 }
      };
      
      const progressEvent = {
        type: 'progress',
        componentId: 'test.component',
        timestamp: Date.now() + 100,
        details: { progress: 50, phase: 'loading' }
      };
      
      const successEvent = {
        type: 'success',
        componentId: 'test.component',
        timestamp: Date.now() + 200,
        details: { duration: 200 }
      };
      
      // Act
      logInitEvent(startEvent);
      logInitEvent(progressEvent);
      logInitEvent(successEvent);
      
      // Assert
      const logs = getInitLogs();
      expect(logs.length).toBe(3);
      
      expect(logs[0].type).toBe('start');
      expect(logs[0].componentId).toBe('test.component');
      expect(logs[0].timestamp).toBeDefined();
      
      expect(logs[1].type).toBe('progress');
      expect(logs[1].details.progress).toBe(50);
      
      expect(logs[2].type).toBe('success');
      expect(logs[2].details.duration).toBe(200);
    });
    
    test('should handle error events with error objects', () => {
      // Arrange
      const error = new Error('Initialization failed');
      const errorEvent = {
        type: 'error',
        componentId: 'test.component',
        timestamp: Date.now(),
        details: { error }
      };
      
      // Act
      logInitEvent(errorEvent);
      
      // Assert
      const logs = getInitLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].type).toBe('error');
      expect(logs[0].details.error.message).toBe('Initialization failed');
    });
    
    test('should assign sequential IDs to log entries', () => {
      // Arrange & Act
      for (let i = 0; i < 5; i++) {
        logInitEvent({
          type: 'info',
          componentId: `component.${i}`,
          timestamp: Date.now() + i
        });
      }
      
      // Assert
      const logs = getInitLogs();
      expect(logs.length).toBe(5);
      
      // Check that IDs are sequential
      for (let i = 0; i < 5; i++) {
        expect(logs[i].id).toBe(i + 1);
      }
    });
  });

  describe('Log Retrieval and Filtering', () => {
    test('should retrieve all logs when no filters are applied', () => {
      // Arrange
      logInitEvent({ type: 'start', componentId: 'component.1', timestamp: 100 });
      logInitEvent({ type: 'progress', componentId: 'component.2', timestamp: 200 });
      logInitEvent({ type: 'success', componentId: 'component.1', timestamp: 300 });
      
      // Act
      const logs = getInitLogs();
      
      // Assert
      expect(logs.length).toBe(3);
    });
    
    test('should filter logs by component ID', () => {
      // Arrange
      logInitEvent({ type: 'start', componentId: 'component.1', timestamp: 100 });
      logInitEvent({ type: 'start', componentId: 'component.2', timestamp: 200 });
      logInitEvent({ type: 'success', componentId: 'component.1', timestamp: 300 });
      
      // Act
      const filteredLogs = getFilteredLogs({ componentId: 'component.1' });
      
      // Assert
      expect(filteredLogs.length).toBe(2);
      expect(filteredLogs[0].componentId).toBe('component.1');
      expect(filteredLogs[1].componentId).toBe('component.1');
    });
    
    test('should filter logs by event type', () => {
      // Arrange
      logInitEvent({ type: 'start', componentId: 'component.1', timestamp: 100 });
      logInitEvent({ type: 'progress', componentId: 'component.1', timestamp: 200 });
      logInitEvent({ type: 'success', componentId: 'component.1', timestamp: 300 });
      logInitEvent({ type: 'start', componentId: 'component.2', timestamp: 400 });
      
      // Act
      const filteredLogs = getFilteredLogs({ type: 'start' });
      
      // Assert
      expect(filteredLogs.length).toBe(2);
      expect(filteredLogs[0].type).toBe('start');
      expect(filteredLogs[1].type).toBe('start');
    });
    
    test('should filter logs by time range', () => {
      // Arrange
      logInitEvent({ type: 'start', componentId: 'component.1', timestamp: 100 });
      logInitEvent({ type: 'progress', componentId: 'component.1', timestamp: 200 });
      logInitEvent({ type: 'success', componentId: 'component.1', timestamp: 300 });
      logInitEvent({ type: 'start', componentId: 'component.2', timestamp: 400 });
      
      // Act
      const filteredLogs = getFilteredLogs({ 
        startTime: 150,
        endTime: 350
      });
      
      // Assert
      expect(filteredLogs.length).toBe(2);
      expect(filteredLogs[0].timestamp).toBe(200);
      expect(filteredLogs[1].timestamp).toBe(300);
    });
    
    test('should combine multiple filter criteria', () => {
      // Arrange
      logInitEvent({ type: 'start', componentId: 'component.1', timestamp: 100 });
      logInitEvent({ type: 'progress', componentId: 'component.1', timestamp: 200 });
      logInitEvent({ type: 'start', componentId: 'component.2', timestamp: 300 });
      logInitEvent({ type: 'success', componentId: 'component.1', timestamp: 400 });
      
      // Act
      const filteredLogs = getFilteredLogs({ 
        componentId: 'component.1',
        type: 'start'
      });
      
      // Assert
      expect(filteredLogs.length).toBe(1);
      expect(filteredLogs[0].componentId).toBe('component.1');
      expect(filteredLogs[0].type).toBe('start');
    });
  });

  describe('Timeline Generation', () => {
    test('should generate timeline data from logs', () => {
      // Arrange
      const startTime = Date.now();
      
      // Component 1 - successful initialization
      logInitEvent({ 
        type: 'start', 
        componentId: 'component.1', 
        timestamp: startTime 
      });
      
      logInitEvent({ 
        type: 'progress', 
        componentId: 'component.1', 
        timestamp: startTime + 50,
        details: { progress: 50, phase: 'loading' }
      });
      
      logInitEvent({ 
        type: 'success', 
        componentId: 'component.1', 
        timestamp: startTime + 100,
        details: { duration: 100 }
      });
      
      // Component 2 - failed initialization
      logInitEvent({ 
        type: 'start', 
        componentId: 'component.2', 
        timestamp: startTime + 20
      });
      
      logInitEvent({ 
        type: 'error', 
        componentId: 'component.2', 
        timestamp: startTime + 80,
        details: { error: new Error('Failed') }
      });
      
      // Act
      const timelineData = generateTimelineData();
      
      // Assert
      expect(timelineData.length).toBe(2); // Two components
      
      const component1Timeline = timelineData.find(item => item.componentId === 'component.1');
      const component2Timeline = timelineData.find(item => item.componentId === 'component.2');
      
      expect(component1Timeline).toBeDefined();
      expect(component1Timeline.events.length).toBe(3);
      expect(component1Timeline.startTime).toBe(startTime);
      expect(component1Timeline.endTime).toBe(startTime + 100);
      expect(component1Timeline.duration).toBe(100);
      expect(component1Timeline.status).toBe('success');
      
      expect(component2Timeline).toBeDefined();
      expect(component2Timeline.events.length).toBe(2);
      expect(component2Timeline.status).toBe('error');
    });
    
    test('should generate HTML visualization from timeline data', () => {
      // Arrange
      const startTime = Date.now();
      
      // Component 1 - successful initialization
      logInitEvent({ type: 'start', componentId: 'component.1', timestamp: startTime });
      logInitEvent({ type: 'success', componentId: 'component.1', timestamp: startTime + 100 });
      
      // Component 2 - failed initialization
      logInitEvent({ type: 'start', componentId: 'component.2', timestamp: startTime + 20 });
      logInitEvent({ type: 'error', componentId: 'component.2', timestamp: startTime + 80 });
      
      // Act
      const timelineData = generateTimelineData();
      const html = generateTimelineVisualization(timelineData);
      
      // Assert
      expect(html).toContain('component.1');
      expect(html).toContain('component.2');
      expect(html).toContain('timeline-bar');
      expect(html).toContain('timeline-success');
      expect(html).toContain('timeline-error');
    });
    
    test('should generate CSS styles for timeline', () => {
      // Act
      const css = getTimelineStyles();
      
      // Assert
      expect(css).toContain('.timeline-container');
      expect(css).toContain('.timeline-bar');
      expect(css).toContain('.timeline-success');
      expect(css).toContain('.timeline-error');
      expect(css).toContain('@media (forced-colors: active)'); // High contrast mode
    });
  });
});
