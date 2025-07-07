/**
 * Integration Test Suite for Initialization System
 * 
 * Tests the integration of the initialization system with other ALEJO components:
 * - Event system integration
 * - Configuration system integration
 * - Error handling and recovery
 * - Resource allocation integration
 * - UI component integration
 */

import { 
  registerComponent,
  unregisterComponent,
  initializeSystem,
  getInitializationStatus,
  pauseInitialization,
  resumeInitialization
} from '../../../src/core/system/initialization-manager.js';

import {
  registerFallbackImplementation,
  getFallbackStatistics
} from '../../../src/core/system/fallback-manager.js';

import {
  initializeProgressiveLoading,
  getLoadingSequenceState,
  loadDeferredComponents
} from '../../../src/core/system/progressive-loading-manager.js';

import {
  openMonitoringDashboard,
  closeMonitoringDashboard,
  getDashboardState
} from '../../../src/core/system/monitoring-dashboard.js';

// Import event bus for testing integration
import {
  publishEvent,
  subscribeToEvent,
  unsubscribeFromEvent
} from '../../../src/core/events/event-bus.js';

// Mock the event bus
jest.mock('../../../src/core/events/event-bus.js', () => ({
  publishEvent: jest.fn(),
  subscribeToEvent: jest.fn(),
  unsubscribeFromEvent: jest.fn()
}));

// Mock the configuration system
jest.mock('../../../src/core/config/config-manager.js', () => ({
  getConfig: jest.fn().mockImplementation((key, defaultValue) => {
    const configs = {
      'initialization.timeout': 5000,
      'initialization.retryCount': 3,
      'initialization.resourceMode': 'normal',
      'accessibility.highContrast': false,
      'initialization.logLevel': 'info'
    };
    return configs[key] !== undefined ? configs[key] : defaultValue;
  }),
  setConfig: jest.fn(),
  subscribeToConfigChanges: jest.fn(),
  unsubscribeFromConfigChanges: jest.fn()
}));

// Import the mocked config manager
import { getConfig, setConfig } from '../../../src/core/config/config-manager.js';

// Mock resource allocation manager
jest.mock('../../../src/core/system/resource-allocation-manager.js', () => {
  let currentMode = 'normal';
  let listeners = [];
  
  return {
    getResourceAllocationManager: jest.fn().mockImplementation(() => ({
      getResourceMode: jest.fn().mockImplementation(() => currentMode),
      setResourceMode: jest.fn().mockImplementation((mode) => {
        currentMode = mode;
        listeners.forEach(listener => listener(mode));
        return true;
      }),
      getResourceUsage: jest.fn().mockImplementation(() => ({
        cpu: currentMode === 'minimal' ? 90 : currentMode === 'conservative' ? 60 : 30,
        memory: currentMode === 'minimal' ? 85 : currentMode === 'conservative' ? 55 : 25,
        battery: currentMode === 'minimal' ? 15 : currentMode === 'conservative' ? 40 : 80
      })),
      registerResourceListener: jest.fn().mockImplementation((listener) => {
        listeners.push(listener);
        return () => {
          listeners = listeners.filter(l => l !== listener);
        };
      })
    }))
  };
});

// Import the mocked resource allocation manager
import { getResourceAllocationManager } from '../../../src/core/system/resource-allocation-manager.js';

// Mock DOM elements
document.body.innerHTML = `
  <div id="alejo-monitoring-dashboard"></div>
  <div id="alejo-dashboard-container"></div>
  <div id="alejo-app-container"></div>
  <div id="alejo-loading-indicator"></div>
`;

describe('Initialization System Integration', () => {
  // Reset all modules before each test
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    
    // Reset DOM
    document.getElementById('alejo-monitoring-dashboard').innerHTML = '';
    document.getElementById('alejo-dashboard-container').innerHTML = '';
    document.getElementById('alejo-app-container').innerHTML = '';
    document.getElementById('alejo-loading-indicator').innerHTML = '';
    
    // Clear any registered components
    const registeredComponents = getInitializationStatus().componentStatus || {};
    Object.keys(registeredComponents).forEach(componentId => {
      unregisterComponent(componentId);
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
    closeMonitoringDashboard();
  });

  describe('Event System Integration', () => {
    test('should publish events during initialization lifecycle', async () => {
      // Arrange
      registerComponent({
        id: 'test.component',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(publishEvent).toHaveBeenCalledWith(
        'system.initialization.started',
        expect.any(Object)
      );
      
      expect(publishEvent).toHaveBeenCalledWith(
        'system.initialization.componentStarted',
        expect.objectContaining({ componentId: 'test.component' })
      );
      
      expect(publishEvent).toHaveBeenCalledWith(
        'system.initialization.componentCompleted',
        expect.objectContaining({ componentId: 'test.component' })
      );
      
      expect(publishEvent).toHaveBeenCalledWith(
        'system.initialization.completed',
        expect.any(Object)
      );
    });
    
    test('should publish events for component failures', async () => {
      // Arrange
      registerComponent({
        id: 'test.failing',
        initialize: jest.fn().mockRejectedValue(new Error('Test failure')),
        priority: 90
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(publishEvent).toHaveBeenCalledWith(
        'system.initialization.componentFailed',
        expect.objectContaining({
          componentId: 'test.failing',
          error: expect.any(Error)
        })
      );
    });
    
    test('should subscribe to system events for monitoring', async () => {
      // Arrange
      openMonitoringDashboard();
      
      // Assert
      expect(subscribeToEvent).toHaveBeenCalledWith(
        'system.initialization.componentStarted',
        expect.any(Function)
      );
      
      expect(subscribeToEvent).toHaveBeenCalledWith(
        'system.initialization.componentCompleted',
        expect.any(Function)
      );
      
      expect(subscribeToEvent).toHaveBeenCalledWith(
        'system.initialization.componentFailed',
        expect.any(Function)
      );
    });
  });

  describe('Configuration System Integration', () => {
    test('should read initialization settings from config', async () => {
      // Arrange
      registerComponent({
        id: 'test.component',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(getConfig).toHaveBeenCalledWith('initialization.timeout', expect.any(Number));
      expect(getConfig).toHaveBeenCalledWith('initialization.retryCount', expect.any(Number));
    });
    
    test('should adapt to config changes', async () => {
      // Arrange
      const mockConfigListener = subscribeToEvent.mock.calls.find(
        call => call[0] === 'config.changed'
      );
      
      // Simulate config change event
      if (mockConfigListener && mockConfigListener[1]) {
        const configChangeHandler = mockConfigListener[1];
        
        // Act - Simulate config change
        configChangeHandler({
          key: 'initialization.resourceMode',
          value: 'conservative',
          previousValue: 'normal'
        });
        
        // Assert
        const resourceManager = getResourceAllocationManager();
        expect(resourceManager.setResourceMode).toHaveBeenCalledWith('conservative');
      }
    });
    
    test('should update dashboard based on accessibility config', async () => {
      // Arrange
      openMonitoringDashboard();
      
      // Simulate high contrast config
      const mockConfigListener = subscribeToEvent.mock.calls.find(
        call => call[0] === 'config.changed'
      );
      
      // Act - Simulate config change
      if (mockConfigListener && mockConfigListener[1]) {
        const configChangeHandler = mockConfigListener[1];
        
        configChangeHandler({
          key: 'accessibility.highContrast',
          value: true,
          previousValue: false
        });
        
        // Assert
        const dashboardState = getDashboardState();
        expect(dashboardState.highContrastMode).toBe(true);
      }
    });
  });

  describe('Resource Allocation Integration', () => {
    test('should adapt initialization strategy based on resource mode', async () => {
      // Arrange
      const resourceManager = getResourceAllocationManager();
      
      // Register components
      registerComponent({
        id: 'test.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'test.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 70,
        isEssential: false
      });
      
      // Act - Set minimal resource mode
      resourceManager.setResourceMode('minimal');
      
      // Initialize with progressive loading
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert
      const loadingState = getLoadingSequenceState();
      expect(loadingState.deferredComponents).toContain('test.nonessential');
      
      // Essential component should be initialized
      const status = getInitializationStatus();
      expect(status.componentStatus['test.essential'].status).toBe('initialized');
    });
    
    test('should pause initialization on critical resource constraints', async () => {
      // Arrange
      const resourceManager = getResourceAllocationManager();
      let resourceListener;
      
      // Capture the resource listener
      resourceManager.registerResourceListener.mockImplementation((listener) => {
        resourceListener = listener;
        return jest.fn();
      });
      
      // Register a slow component
      const slowInitialize = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(true), 1000);
        });
      });
      
      registerComponent({
        id: 'test.slow',
        initialize: slowInitialize,
        priority: 90
      });
      
      // Start initialization
      const initPromise = initializeSystem();
      
      // Act - Simulate critical resource usage during initialization
      if (resourceListener) {
        resourceListener('critical');
      }
      
      // Fast-forward timers to complete initialization
      jest.advanceTimersByTime(1000);
      await initPromise;
      
      // Assert
      expect(pauseInitialization).toHaveBeenCalled;
      
      // Check if system tried to resume when resources improved
      if (resourceListener) {
        resourceListener('normal');
      }
      
      expect(resumeInitialization).toHaveBeenCalled;
    });
  });

  describe('UI Integration', () => {
    test('should update loading indicator during initialization', async () => {
      // Arrange
      const loadingIndicator = document.getElementById('alejo-loading-indicator');
      
      // Register components
      registerComponent({
        id: 'test.component1',
        initialize: jest.fn().mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve(true), 100);
          });
        }),
        priority: 90
      });
      
      registerComponent({
        id: 'test.component2',
        initialize: jest.fn().mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve(true), 200);
          });
        }),
        priority: 80
      });
      
      // Act - Start initialization
      const initPromise = initializeSystem();
      
      // Check loading indicator after component1 starts
      jest.advanceTimersByTime(50);
      
      // Simulate the event system updating the loading indicator
      const mockStartedEvent = publishEvent.mock.calls.find(
        call => call[0] === 'system.initialization.componentStarted'
      );
      
      if (mockStartedEvent && mockStartedEvent[1]) {
        loadingIndicator.innerHTML = `<div>Loading ${mockStartedEvent[1].componentId}...</div>`;
      }
      
      // Assert - Loading indicator should show component being initialized
      expect(loadingIndicator.innerHTML).toContain('test.component1');
      
      // Complete initialization
      jest.advanceTimersByTime(250);
      await initPromise;
      
      // Simulate completion event
      const mockCompletedEvent = publishEvent.mock.calls.find(
        call => call[0] === 'system.initialization.completed'
      );
      
      if (mockCompletedEvent) {
        loadingIndicator.innerHTML = '';
      }
      
      // Loading indicator should be empty after completion
      expect(loadingIndicator.innerHTML).toBe('');
    });
    
    test('should integrate monitoring dashboard with app container', async () => {
      // Arrange
      const appContainer = document.getElementById('alejo-app-container');
      
      // Register components
      registerComponent({
        id: 'ui.component',
        initialize: jest.fn().mockImplementation(() => {
          appContainer.innerHTML = '<div id="test-ui">Test UI Component</div>';
          return Promise.resolve(true);
        }),
        priority: 90
      });
      
      // Act
      await initializeSystem();
      openMonitoringDashboard();
      
      // Assert
      // Dashboard should be visible but not interfere with app container
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      expect(dashboard.style.display).not.toBe('none');
      
      // App container should still have its content
      expect(appContainer.innerHTML).toContain('Test UI Component');
      
      // Dashboard should be positioned to not obscure app content
      expect(dashboard.style.position).toBe('fixed');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should recover from component failures using fallbacks', async () => {
      // Arrange
      registerComponent({
        id: 'test.failing',
        initialize: jest.fn().mockRejectedValue(new Error('Test failure')),
        priority: 90
      });
      
      const fallbackImplementation = jest.fn().mockResolvedValue(true);
      registerFallbackImplementation('test.failing', fallbackImplementation);
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(fallbackImplementation).toHaveBeenCalled();
      
      // System should report component as using fallback
      const fallbackStats = getFallbackStatistics();
      expect(fallbackStats.componentsUsingFallbacks).toContain('test.failing');
    });
    
    test('should handle cascading failures and dependencies', async () => {
      // Arrange - Create components with dependencies
      registerComponent({
        id: 'test.dependency',
        initialize: jest.fn().mockRejectedValue(new Error('Dependency failed')),
        priority: 100
      });
      
      registerComponent({
        id: 'test.dependent',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        dependencies: ['test.dependency']
      });
      
      // Register fallback for dependency
      const fallbackImplementation = jest.fn().mockResolvedValue(true);
      registerFallbackImplementation('test.dependency', fallbackImplementation);
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(fallbackImplementation).toHaveBeenCalled();
      
      // Dependent component should initialize after fallback resolves
      expect(getInitializationStatus().componentStatus['test.dependent'].status).toBe('initialized');
    });
    
    test('should handle retry logic for transient failures', async () => {
      // Arrange
      const failingInitialize = jest.fn()
        .mockRejectedValueOnce(new Error('Transient failure 1'))
        .mockRejectedValueOnce(new Error('Transient failure 2'))
        .mockResolvedValue(true);
      
      registerComponent({
        id: 'test.transient',
        initialize: failingInitialize,
        priority: 90,
        retryCount: 3
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(failingInitialize).toHaveBeenCalledTimes(3);
      
      // Component should eventually succeed
      expect(getInitializationStatus().componentStatus['test.transient'].status).toBe('initialized');
    });
  });

  describe('Cross-Component Integration', () => {
    test('should handle complex dependency chains', async () => {
      // Arrange - Create a complex dependency chain
      registerComponent({
        id: 'base.component',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 100
      });
      
      registerComponent({
        id: 'mid.component1',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        dependencies: ['base.component']
      });
      
      registerComponent({
        id: 'mid.component2',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 85,
        dependencies: ['base.component']
      });
      
      registerComponent({
        id: 'top.component',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 80,
        dependencies: ['mid.component1', 'mid.component2']
      });
      
      // Act
      await initializeSystem();
      
      // Assert - All components should be initialized in dependency order
      const status = getInitializationStatus();
      expect(status.componentStatus['base.component'].status).toBe('initialized');
      expect(status.componentStatus['mid.component1'].status).toBe('initialized');
      expect(status.componentStatus['mid.component2'].status).toBe('initialized');
      expect(status.componentStatus['top.component'].status).toBe('initialized');
      
      // Check initialization order
      const baseInit = status.componentStatus['base.component'].completedAt;
      const mid1Init = status.componentStatus['mid.component1'].completedAt;
      const mid2Init = status.componentStatus['mid.component2'].completedAt;
      const topInit = status.componentStatus['top.component'].completedAt;
      
      expect(baseInit).toBeLessThan(mid1Init);
      expect(baseInit).toBeLessThan(mid2Init);
      expect(mid1Init).toBeLessThan(topInit);
      expect(mid2Init).toBeLessThan(topInit);
    });
    
    test('should handle circular dependencies gracefully', async () => {
      // Arrange - Create a circular dependency
      registerComponent({
        id: 'circular.a',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        dependencies: ['circular.b']
      });
      
      registerComponent({
        id: 'circular.b',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        dependencies: ['circular.a']
      });
      
      // Act
      await initializeSystem();
      
      // Assert - System should detect and handle circular dependency
      const status = getInitializationStatus();
      
      // Both components should have error status
      expect(status.componentStatus['circular.a'].status).toBe('error');
      expect(status.componentStatus['circular.b'].status).toBe('error');
      
      // Error should mention circular dependency
      expect(status.componentStatus['circular.a'].error.message)
        .toContain('circular');
    });
  });
});
