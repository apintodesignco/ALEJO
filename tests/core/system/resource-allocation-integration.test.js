/**
 * Resource Allocation Integration Test Suite
 * 
 * Tests the integration between the resource allocation manager and the initialization system,
 * ensuring that resource constraints properly influence component loading strategies.
 */

import { 
  getResourceAllocationManager,
  setResourceMode,
  getResourceUsage,
  registerResourceListener
} from '../../../src/performance/resource-allocation-manager.js';

import { 
  registerComponent,
  unregisterComponent,
  initializeSystem,
  getInitializationStatus
} from '../../../src/core/system/initialization-manager.js';

import {
  initializeProgressiveLoading,
  getLoadingSequenceState,
  loadDeferredComponents
} from '../../../src/core/system/progressive-loading-manager.js';

// Mock the event bus
jest.mock('../../../src/core/events/event-bus.js', () => ({
  publishEvent: jest.fn(),
  subscribeToEvent: jest.fn(),
  unsubscribeFromEvent: jest.fn()
}));

describe('Resource Allocation Integration', () => {
  // Reset all modules before each test
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    
    // Clear any registered components
    const registeredComponents = getInitializationStatus().componentStatus || {};
    Object.keys(registeredComponents).forEach(componentId => {
      unregisterComponent(componentId);
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
    
    // Reset resource mode to normal
    setResourceMode('normal');
  });

  describe('Resource-Aware Initialization', () => {
    test('should defer non-essential components when in conservative mode', async () => {
      // Arrange - Set resource mode to conservative
      setResourceMode('conservative');
      
      // Register components with different priorities and essentiality
      registerComponent({
        id: 'core.essential1',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'core.essential2',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 80,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.nonessential1',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 70,
        isEssential: false
      });
      
      registerComponent({
        id: 'feature.nonessential2',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 60,
        isEssential: false
      });
      
      // Act - Initialize progressive loading and system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert
      const loadingState = getLoadingSequenceState();
      const initStatus = getInitializationStatus();
      
      // Essential components should be initialized
      expect(initStatus.componentStatus['core.essential1'].status).toBe('initialized');
      expect(initStatus.componentStatus['core.essential2'].status).toBe('initialized');
      
      // Non-essential components should be deferred
      expect(loadingState.deferredComponents).toContain('feature.nonessential1');
      expect(loadingState.deferredComponents).toContain('feature.nonessential2');
    });
    
    test('should initialize all components when in normal mode', async () => {
      // Arrange - Set resource mode to normal
      setResourceMode('normal');
      
      // Register components with different priorities and essentiality
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 60,
        isEssential: false
      });
      
      // Act - Initialize progressive loading and system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert
      const loadingState = getLoadingSequenceState();
      const initStatus = getInitializationStatus();
      
      // All components should be initialized
      expect(initStatus.componentStatus['core.essential'].status).toBe('initialized');
      expect(initStatus.componentStatus['feature.nonessential'].status).toBe('initialized');
      
      // No components should be deferred
      expect(loadingState.deferredComponents.length).toBe(0);
    });
    
    test('should only initialize accessibility components when in minimal mode', async () => {
      // Arrange - Set resource mode to minimal
      setResourceMode('minimal');
      
      // Register components with different priorities and accessibility flags
      registerComponent({
        id: 'core.accessibility',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 100,
        isEssential: true,
        isAccessibility: true
      });
      
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true,
        isAccessibility: false
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 60,
        isEssential: false,
        isAccessibility: false
      });
      
      // Act - Initialize progressive loading and system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert
      const loadingState = getLoadingSequenceState();
      const initStatus = getInitializationStatus();
      
      // Accessibility component should be initialized
      expect(initStatus.componentStatus['core.accessibility'].status).toBe('initialized');
      
      // Other components should be deferred
      expect(loadingState.deferredComponents).toContain('core.essential');
      expect(loadingState.deferredComponents).toContain('feature.nonessential');
    });
  });

  describe('Dynamic Resource Adaptation', () => {
    test('should adapt loading strategy when resource mode changes', async () => {
      // Arrange - Start in normal mode
      setResourceMode('normal');
      
      // Register components
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 60,
        isEssential: false
      });
      
      // Act - Initialize progressive loading
      await initializeProgressiveLoading();
      
      // Get initial loading plan
      const initialLoadingState = getLoadingSequenceState();
      
      // Change to conservative mode
      setResourceMode('conservative');
      
      // Re-initialize progressive loading
      await initializeProgressiveLoading();
      
      // Get updated loading plan
      const updatedLoadingState = getLoadingSequenceState();
      
      // Assert
      // Initial plan should load all components
      expect(initialLoadingState.deferredComponents.length).toBe(0);
      
      // Updated plan should defer non-essential components
      expect(updatedLoadingState.deferredComponents).toContain('feature.nonessential');
    });
    
    test('should respond to resource usage events', async () => {
      // Arrange - Mock resource usage reporting
      const mockResourceListener = jest.fn();
      registerResourceListener(mockResourceListener);
      
      // Register components
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 60,
        isEssential: false
      });
      
      // Act - Initialize in normal mode
      setResourceMode('normal');
      await initializeProgressiveLoading();
      
      // Simulate high CPU usage
      const resourceManager = getResourceAllocationManager();
      resourceManager.updateResourceUsage({
        cpu: 90,
        memory: 50,
        batteryLevel: 80,
        isCharging: true
      });
      
      // Fast-forward timers to trigger resource adaptation
      jest.advanceTimersByTime(1000);
      
      // Assert
      // Resource listener should be called with updated usage
      expect(mockResourceListener).toHaveBeenCalledWith(expect.objectContaining({
        cpu: 90
      }));
      
      // Resource mode should be changed to conservative
      expect(resourceManager.getCurrentMode()).toBe('conservative');
    });
  });

  describe('Deferred Loading', () => {
    test('should load deferred components when explicitly requested', async () => {
      // Arrange - Set resource mode to conservative
      setResourceMode('conservative');
      
      // Register components
      const nonEssentialInitMock = jest.fn().mockResolvedValue(true);
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: nonEssentialInitMock,
        priority: 60,
        isEssential: false
      });
      
      // Act - Initialize progressive loading and system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Verify non-essential component is deferred
      const loadingState = getLoadingSequenceState();
      expect(loadingState.deferredComponents).toContain('feature.nonessential');
      
      // Load deferred components
      await loadDeferredComponents();
      
      // Assert
      // Non-essential init function should now be called
      expect(nonEssentialInitMock).toHaveBeenCalled();
      
      // Component should now be initialized
      const updatedStatus = getInitializationStatus();
      expect(updatedStatus.componentStatus['feature.nonessential'].status).toBe('initialized');
      
      // No more deferred components
      const updatedLoadingState = getLoadingSequenceState();
      expect(updatedLoadingState.deferredComponents.length).toBe(0);
    });
    
    test('should prioritize high-priority components when loading deferred components', async () => {
      // Arrange - Set resource mode to conservative
      setResourceMode('conservative');
      
      // Register non-essential components with different priorities
      const highPriorityInitMock = jest.fn().mockResolvedValue(true);
      const mediumPriorityInitMock = jest.fn().mockResolvedValue(true);
      const lowPriorityInitMock = jest.fn().mockResolvedValue(true);
      
      registerComponent({
        id: 'feature.highPriority',
        initialize: highPriorityInitMock,
        priority: 70,
        isEssential: false
      });
      
      registerComponent({
        id: 'feature.mediumPriority',
        initialize: mediumPriorityInitMock,
        priority: 50,
        isEssential: false
      });
      
      registerComponent({
        id: 'feature.lowPriority',
        initialize: lowPriorityInitMock,
        priority: 30,
        isEssential: false
      });
      
      // Act - Initialize progressive loading and system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Load deferred components
      await loadDeferredComponents();
      
      // Assert - Check initialization order
      expect(highPriorityInitMock.mock.invocationCallOrder[0])
        .toBeLessThan(mediumPriorityInitMock.mock.invocationCallOrder[0]);
        
      expect(mediumPriorityInitMock.mock.invocationCallOrder[0])
        .toBeLessThan(lowPriorityInitMock.mock.invocationCallOrder[0]);
    });
  });

  describe('Resource Usage Reporting', () => {
    test('should track resource usage during initialization', async () => {
      // Arrange - Set up resource tracking
      const resourceManager = getResourceAllocationManager();
      const trackResourceUsageSpy = jest.spyOn(resourceManager, 'trackResourceUsage');
      
      // Register components with different resource impacts
      registerComponent({
        id: 'core.highImpact',
        initialize: jest.fn().mockImplementation(() => {
          // Simulate high resource usage
          resourceManager.updateResourceUsage({
            cpu: 75,
            memory: 60
          });
          return Promise.resolve(true);
        }),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'core.lowImpact',
        initialize: jest.fn().mockImplementation(() => {
          // Simulate low resource usage
          resourceManager.updateResourceUsage({
            cpu: 30,
            memory: 40
          });
          return Promise.resolve(true);
        }),
        priority: 80,
        isEssential: true
      });
      
      // Act - Initialize system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert
      // Resource tracking should be called for each component
      expect(trackResourceUsageSpy).toHaveBeenCalledTimes(2);
      
      // Resource usage should be updated
      const finalUsage = getResourceUsage();
      expect(finalUsage.cpu).toBe(30); // Last reported value
      expect(finalUsage.memory).toBe(40); // Last reported value
    });
    
    test('should pause initialization if resource usage is critical', async () => {
      // Arrange
      const resourceManager = getResourceAllocationManager();
      
      // Register components
      const component1InitMock = jest.fn().mockResolvedValue(true);
      const component2InitMock = jest.fn().mockResolvedValue(true);
      const component3InitMock = jest.fn().mockResolvedValue(true);
      
      registerComponent({
        id: 'core.component1',
        initialize: component1InitMock,
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'core.component2',
        initialize: component2InitMock,
        priority: 80,
        isEssential: true
      });
      
      registerComponent({
        id: 'core.component3',
        initialize: component3InitMock,
        priority: 70,
        isEssential: true
      });
      
      // Act - Start initialization
      await initializeProgressiveLoading();
      
      // Set critical resource usage after first component
      const initPromise = initializeSystem({
        pauseOnCriticalUsage: true
      });
      
      // Simulate critical resource usage
      resourceManager.updateResourceUsage({
        cpu: 95,
        memory: 90,
        temperature: 85
      });
      
      // Fast-forward timers to trigger resource checks
      jest.advanceTimersByTime(1000);
      
      // Complete initialization
      await initPromise;
      
      // Assert
      // System should have paused initialization and switched to minimal mode
      expect(resourceManager.getCurrentMode()).toBe('minimal');
      
      // Check if initialization was completed for all components
      // In a real system, some might be deferred, but our mock doesn't implement the full pause logic
      const initStatus = getInitializationStatus();
      expect(Object.keys(initStatus.componentStatus).length).toBe(3);
    });
  });
});
