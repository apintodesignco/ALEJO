/**
 * ALEJO Voice Command Processor - Unit Tests
 * 
 * This module contains comprehensive tests for the voice command processor
 * to ensure it's production-ready with proper error handling, accessibility
 * support, security checks, and resource management integration.
 */

import * as CommandProcessor from './command-processor.js';

// Mock dependencies
const mockEventBus = {
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  publish: jest.fn()
};

const mockResourceManager = {
  registerComponent: jest.fn().mockResolvedValue(true),
  unregisterComponent: jest.fn().mockResolvedValue(true),
  getCurrentResourceMode: jest.fn().mockReturnValue('medium')
};

const mockAuditTrail = {
  addEntry: jest.fn()
};

const mockSecurityManager = {
  checkCommandSecurity: jest.fn().mockResolvedValue({ allowed: true })
};

const mockAccessibilityManager = {
  announce: jest.fn(),
  getPreferences: jest.fn().mockReturnValue({
    verboseAnnouncements: false,
    confirmationRequired: false,
    commandFeedback: true
  })
};

// Mock system modules
jest.mock('../../../utils/event-bus.js', () => mockEventBus);
jest.mock('../../../utils/resource-manager.js', () => mockResourceManager);
jest.mock('../../../utils/audit-trail.js', () => mockAuditTrail);
jest.mock('../../../security/security-manager.js', () => mockSecurityManager);
jest.mock('../../../utils/accessibility-manager.js', () => mockAccessibilityManager);

describe('Voice Command Processor', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset module state
    CommandProcessor.shutdown({ force: true, clearHistory: true });
  });

  describe('Initialization', () => {
    test('Should initialize with default options', async () => {
      const result = await CommandProcessor.initialize();
      expect(result.success).toBe(true);
      expect(mockEventBus.subscribe).toHaveBeenCalled();
      expect(mockResourceManager.registerComponent).toHaveBeenCalled();
    });

    test('Should initialize with custom options', async () => {
      const options = {
        enableResourceManagement: false,
        customCommandPatterns: { 'test:pattern': { handler: 'test' } },
        customCommandHandlers: { test: jest.fn() },
        initialContext: 'test',
        enableAccessibilityFeatures: true,
        performanceLevel: 'minimal'
      };
      
      const result = await CommandProcessor.initialize(options);
      expect(result.success).toBe(true);
      expect(result.customPatternsAdded).toBe(1);
      expect(result.customHandlersAdded).toBe(1);
      expect(CommandProcessor.getCommandContext()).toBe('test');
    });

    test('Should handle initialization errors', async () => {
      mockEventBus.subscribe.mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const result = await CommandProcessor.initialize();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Command Processing', () => {
    beforeEach(async () => {
      await CommandProcessor.initialize();
      
      // Register test command patterns
      CommandProcessor.registerCommandPattern('test command *', {
        handler: 'testHandler',
        importance: 'normal'
      });
      
      CommandProcessor.registerCommandPattern('critical command *', {
        handler: 'criticalHandler',
        importance: 'critical'
      });
      
      // Register test command handlers
      CommandProcessor.registerCommandHandler('testHandler', jest.fn().mockResolvedValue({
        success: true,
        message: 'Command executed'
      }));
      
      CommandProcessor.registerCommandHandler('criticalHandler', jest.fn().mockResolvedValue({
        success: true,
        message: 'Critical command executed',
        announce: true
      }));
    });

    test('Should process a valid command', async () => {
      const result = await CommandProcessor.processCommand('test command action');
      expect(result.success).toBe(true);
      expect(result.handled).toBe(true);
    });

    test('Should handle critical commands', async () => {
      const result = await CommandProcessor.processCommand('critical command action');
      expect(result.success).toBe(true);
      expect(mockAccessibilityManager.announce).toHaveBeenCalled();
    });

    test('Should reject uninitialized state', async () => {
      await CommandProcessor.shutdown();
      
      await expect(CommandProcessor.processCommand('test command')).rejects.toThrow(
        'Voice command processor not initialized'
      );
    });

    test('Should handle unrecognized commands', async () => {
      const result = await CommandProcessor.processCommand('unknown command');
      expect(result.success).toBe(false);
      expect(result.handled).toBe(false);
      expect(result.message).toBe('Command not recognized');
      expect(mockEventBus.publish).toHaveBeenCalledWith('voice:unrecognizedCommand', expect.any(Object));
    });

    test('Should block commands that fail security checks', async () => {
      mockSecurityManager.checkCommandSecurity.mockResolvedValueOnce({
        allowed: false,
        reason: 'Security policy violation'
      });
      
      const result = await CommandProcessor.processCommand('test command action');
      expect(result.success).toBe(false);
      expect(result.handled).toBe(true);
      expect(result.message).toBe('Command blocked by security policy');
      expect(mockEventBus.publish).toHaveBeenCalledWith('security:commandBlocked', expect.any(Object));
    });

    test('Should apply throttling to prevent resource exhaustion', async () => {
      // Override the throttling configuration for testing
      await CommandProcessor.initialize({
        commandThrottling: {
          enabled: true,
          maxCommandsPerMinute: 3,
          commandTimestamps: [],
          criticalCommandsExempt: true
        }
      });
      
      // Execute commands up to the limit
      await CommandProcessor.processCommand('test command 1');
      await CommandProcessor.processCommand('test command 2');
      await CommandProcessor.processCommand('test command 3');
      
      // This should be throttled
      const result = await CommandProcessor.processCommand('test command 4');
      expect(result.success).toBe(false);
      expect(result.throttled).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
      
      // Critical commands should bypass throttling
      const criticalResult = await CommandProcessor.processCommand('critical command action');
      expect(criticalResult.success).toBe(true);
    });
  });

  describe('Resource Management', () => {
    test('Should adapt to resource mode changes', async () => {
      await CommandProcessor.initialize();
      
      // Simulate resource mode change callback
      const callbackCaptor = mockResourceManager.registerComponent.mock.calls[0][1].onResourceModeChange;
      expect(callbackCaptor).toBeDefined();
      
      // Test low resource mode
      callbackCaptor('low');
      
      // Test high resource mode
      callbackCaptor('high');
      
      // Verify adaptation occurs (would check internal state if exposed)
      expect(mockAuditTrail.addEntry).toHaveBeenCalledWith(
        expect.stringContaining('resourceMode'), 
        expect.any(Object)
      );
    });
  });

  describe('Shutdown', () => {
    test('Should perform clean shutdown', async () => {
      await CommandProcessor.initialize();
      
      const result = await CommandProcessor.shutdown();
      expect(result.success).toBe(true);
      expect(mockEventBus.unsubscribe).toHaveBeenCalled();
      expect(mockResourceManager.unregisterComponent).toHaveBeenCalled();
    });

    test('Should force shutdown if requested despite errors', async () => {
      await CommandProcessor.initialize();
      
      mockResourceManager.unregisterComponent.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await CommandProcessor.shutdown({ force: true });
      expect(result.success).toBe(false);
      expect(result.forced).toBe(true);
    });
  });

  describe('Accessibility Support', () => {
    test('Should make appropriate announcements', async () => {
      await CommandProcessor.initialize({ enableAccessibilityFeatures: true });
      
      // Process a command that should trigger an announcement
      await CommandProcessor.processCommand('critical command action');
      
      expect(mockAccessibilityManager.announce).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          priority: expect.any(String)
        })
      );
    });
  });

  describe('Command History', () => {
    test('Should track command history', async () => {
      await CommandProcessor.initialize();
      
      await CommandProcessor.processCommand('test command 1');
      await CommandProcessor.processCommand('test command 2');
      
      const history = CommandProcessor.getCommandHistory();
      expect(history.length).toBe(2);
      expect(history[0].command).toBe('test command 2'); // Most recent first
      
      CommandProcessor.clearCommandHistory();
      expect(CommandProcessor.getCommandHistory().length).toBe(0);
    });
  });
});
