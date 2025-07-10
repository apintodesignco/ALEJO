/**
 * ALEJO Voice System Integration Tests
 * 
 * This module provides comprehensive tests for the voice system components
 * working together, with a focus on initialization, shutdown, resource management,
 * accessibility, and error handling.
 */

import * as voiceSystem from './index.js';

// Mock dependencies
jest.mock('./training.js', () => ({
  shutdown: jest.fn().mockResolvedValue({ success: true }),
  initialize: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('./recognition.js', () => ({
  shutdown: jest.fn().mockResolvedValue({ success: true }),
  initialize: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('./synthesis.js', () => ({
  shutdown: jest.fn().mockResolvedValue({ success: true }),
  initialize: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('./command-processor.js', () => ({
  shutdown: jest.fn().mockResolvedValue({ success: true }),
  initialize: jest.fn().mockResolvedValue({ success: true }),
  processCommand: jest.fn().mockResolvedValue({ success: true, handled: true })
}));

jest.mock('./advanced-features.js', () => ({
  shutdown: jest.fn().mockResolvedValue({ success: true }),
  initialize: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('./performance-integration.js', () => ({
  registerWithResourceManager: jest.fn().mockResolvedValue(true),
  unregisterFromResourceManager: jest.fn().mockResolvedValue(true)
}));

jest.mock('./monitoring-integration.js', () => ({
  initializeMonitoring: jest.fn().mockResolvedValue(true),
  getVoiceStatus: jest.fn().mockReturnValue({ status: 'online' }),
  resetStatistics: jest.fn()
}));

jest.mock('./dashboard-integration.js', () => ({
  initializeDashboard: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../core/events.js', () => ({
  publish: jest.fn()
}));

jest.mock('../../utils/audit-trail.js', () => ({
  addEntry: jest.fn()
}));

// Mock performance.now() for consistent timing tests
const originalNow = global.performance.now;
global.performance.now = jest.fn().mockReturnValue(1000);

describe('ALEJO Voice System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset module state
    voiceSystem.shutdown({ force: true }).catch(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.performance.now = originalNow;
  });

  describe('Initialization', () => {
    test('Should initialize all components with default options', async () => {
      const result = await voiceSystem.initialize();
      expect(result.success).toBe(true);
      
      // Verify all components were initialized
      const { training, recognition, synthesis, commandProcessor, advancedFeatures } = require('./index');
      expect(training.initialize).toHaveBeenCalled();
      expect(recognition.initialize).toHaveBeenCalled();
      expect(synthesis.initialize).toHaveBeenCalled();
      expect(commandProcessor.initialize).toHaveBeenCalled();
      expect(advancedFeatures.initialize).toHaveBeenCalled();
      
      // Verify resource registration
      const { registerWithResourceManager } = require('./performance-integration');
      expect(registerWithResourceManager).toHaveBeenCalled();
    });

    test('Should handle component initialization failures gracefully', async () => {
      // Mock one component to fail
      const { initialize } = require('./command-processor');
      initialize.mockRejectedValueOnce(new Error('Test failure'));
      
      // Test partial initialization with allowPartialInit=true
      const result = await voiceSystem.initialize({ allowPartialInit: true });
      expect(result.success).toBe(true);
      expect(result.partial).toBe(true);
      expect(result.componentErrors).toBeDefined();
      expect(result.componentErrors.commandProcessor).toBeDefined();
      
      // Test with allowPartialInit=false
      initialize.mockRejectedValueOnce(new Error('Test failure'));
      const strictResult = await voiceSystem.initialize({ allowPartialInit: false });
      expect(strictResult.success).toBe(false);
    });
    
    test('Should respect resource constraints', async () => {
      // Test initialization with low resources
      await voiceSystem.initialize({ performanceLevel: 'minimal' });
      
      // Verify components received appropriate performance options
      const { commandProcessor } = require('./index');
      expect(commandProcessor.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ performanceLevel: 'minimal' })
      );
    });
  });

  describe('Shutdown', () => {
    test('Should shut down all components cleanly', async () => {
      // First initialize
      await voiceSystem.initialize();
      
      // Then shutdown
      const result = await voiceSystem.shutdown();
      expect(result.success).toBe(true);
      
      // Verify all components were shut down
      const { training, recognition, synthesis, commandProcessor, advancedFeatures } = require('./index');
      expect(commandProcessor.shutdown).toHaveBeenCalled();
      expect(training.shutdown).toHaveBeenCalled();
      expect(recognition.shutdown).toHaveBeenCalled();
      expect(synthesis.shutdown).toHaveBeenCalled();
      expect(advancedFeatures.shutdown).toHaveBeenCalled();
      
      // Verify resource deregistration
      const { unregisterFromResourceManager } = require('./performance-integration');
      expect(unregisterFromResourceManager).toHaveBeenCalled();
    });

    test('Should handle component shutdown failures', async () => {
      // Initialize
      await voiceSystem.initialize();
      
      // Mock one component to fail during shutdown
      const { shutdown } = require('./command-processor');
      shutdown.mockRejectedValueOnce(new Error('Shutdown failure'));
      
      // Test regular shutdown - should fail
      const result = await voiceSystem.shutdown();
      expect(result.success).toBe(false);
      expect(result.errors.commandProcessor).toBeDefined();
      
      // Test forced shutdown - should succeed despite errors
      const forcedResult = await voiceSystem.shutdown({ force: true });
      expect(forcedResult.forced).toBe(true);
    });
    
    test('Should clean up data when requested', async () => {
      // Initialize
      await voiceSystem.initialize();
      
      // Test data clearing option
      const result = await voiceSystem.shutdown({ clearData: true });
      expect(result.dataCleared).toBe(true);
    });
    
    test('Should make accessibility announcements', async () => {
      // Initialize
      await voiceSystem.initialize();
      
      // Test with announcements enabled
      await voiceSystem.shutdown({ announceShutdown: true });
      
      // Verify announcement was made
      const { publish } = require('../../core/events.js');
      expect(publish).toHaveBeenCalledWith(
        'accessibility:announce',
        expect.objectContaining({
          message: expect.stringContaining('shutting down'),
          priority: expect.any(String)
        })
      );
    });
  });

  describe('Resource Management', () => {
    test('Should adapt to resource constraints', async () => {
      // Initialize with resource management
      await voiceSystem.initialize({ enableResourceManagement: true });
      
      // Get the resource management callback
      const { registerWithResourceManager } = require('./performance-integration');
      const callback = registerWithResourceManager.mock.calls[0][1].onResourceModeChange;
      
      // Simulate resource mode change
      callback('low');
      
      // Verify audit logging of mode change
      const { addEntry } = require('../../utils/audit-trail.js');
      expect(addEntry).toHaveBeenCalledWith(
        expect.stringContaining('resourceMode'),
        expect.objectContaining({
          mode: 'low'
        })
      );
    });
  });

  describe('Health Monitoring', () => {
    test('Should perform health checks', async () => {
      // Enable health checks with short interval for testing
      await voiceSystem.initialize({ 
        enableHealthChecks: true,
        healthCheckInterval: 1000
      });
      
      // Fast-forward time to trigger health check
      jest.advanceTimersByTime(1000);
      
      // Get status and verify
      const status = voiceSystem.getVoiceStatus();
      expect(status).toBeDefined();
      expect(status.status).toBe('online');
    });
  });
  
  describe('Error Handling', () => {
    test('Should handle timeouts gracefully', async () => {
      // Mock a component to hang indefinitely
      const { initialize } = require('./recognition');
      initialize.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
      
      // Set short timeout
      const result = await voiceSystem.initialize({ initTimeout: 500 });
      
      // Fast-forward past the timeout
      jest.advanceTimersByTime(600);
      
      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
    });
  });
});
