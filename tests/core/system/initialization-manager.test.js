/**
 * Initialization Manager Test Suite
 * 
 * Tests the functionality of the initialization manager including:
 * - Component registration
 * - System initialization
 * - Component status tracking
 * - Dependency resolution
 * - Error handling
 */

import { 
  registerComponent,
  unregisterComponent,
  initializeSystem,
  getInitializationStatus,
  isInitializationSuccessful,
  getComponentStatus
} from '../../../src/core/system/initialization-manager.js';

// Mock dependencies
import { logInitEvent } from '../../../src/core/system/initialization-log-viewer.js';
import { publishEvent } from '../../../src/core/event-bus.js';

// Mock the dependencies
jest.mock('../../../src/core/system/initialization-log-viewer.js', () => ({
  logInitEvent: jest.fn()
}));

jest.mock('../../../src/core/event-bus.js', () => ({
  publishEvent: jest.fn()
}));

describe('Initialization Manager', () => {
  // Reset mocks and state before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset initialization state by re-initializing the module
    jest.resetModules();
    
    // Clear any registered components
    const registeredComponents = Object.keys(getInitializationStatus().components || {});
    registeredComponents.forEach(componentId => {
      unregisterComponent(componentId);
    });
  });

  describe('Component Registration', () => {
    test('should register a component successfully', () => {
      // Arrange
      const componentId = 'test.component';
      const initFunction = jest.fn().mockResolvedValue({ status: 'ready' });
      
      // Act
      const result = registerComponent(componentId, {
        initFunction,
        dependencies: [],
        isEssential: true,
        accessibility: false,
        priority: 100
      });
      
      // Assert
      expect(result).toBe(true);
      const status = getInitializationStatus();
      expect(status.components[componentId]).toBeDefined();
      expect(status.components[componentId].isEssential).toBe(true);
      expect(status.components[componentId].accessibility).toBe(false);
      expect(status.components[componentId].priority).toBe(100);
    });
    
    test('should not register a component with duplicate ID', () => {
      // Arrange
      const componentId = 'test.component';
      const initFunction = jest.fn().mockResolvedValue({ status: 'ready' });
      
      // Act
      registerComponent(componentId, {
        initFunction,
        dependencies: [],
        isEssential: true
      });
      
      const result = registerComponent(componentId, {
        initFunction,
        dependencies: [],
        isEssential: false
      });
      
      // Assert
      expect(result).toBe(false);
      const status = getInitializationStatus();
      expect(status.components[componentId].isEssential).toBe(true); // Original value preserved
    });
    
    test('should unregister a component successfully', () => {
      // Arrange
      const componentId = 'test.component';
      const initFunction = jest.fn().mockResolvedValue({ status: 'ready' });
      registerComponent(componentId, {
        initFunction,
        dependencies: [],
        isEssential: true
      });
      
      // Act
      const result = unregisterComponent(componentId);
      
      // Assert
      expect(result).toBe(true);
      const status = getInitializationStatus();
      expect(status.components[componentId]).toBeUndefined();
    });
  });

  describe('System Initialization', () => {
    test('should initialize components in dependency order', async () => {
      // Arrange
      const component1 = 'test.component1';
      const component2 = 'test.component2';
      const component3 = 'test.component3';
      
      const init1 = jest.fn().mockResolvedValue({ status: 'ready' });
      const init2 = jest.fn().mockResolvedValue({ status: 'ready' });
      const init3 = jest.fn().mockResolvedValue({ status: 'ready' });
      
      registerComponent(component1, {
        initFunction: init1,
        dependencies: [],
        priority: 100
      });
      
      registerComponent(component2, {
        initFunction: init2,
        dependencies: [component1],
        priority: 90
      });
      
      registerComponent(component3, {
        initFunction: init3,
        dependencies: [component2],
        priority: 80
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(init1).toHaveBeenCalled();
      expect(init2).toHaveBeenCalled();
      expect(init3).toHaveBeenCalled();
      
      // Check initialization order based on dependencies
      const init1CallTime = init1.mock.invocationCallOrder[0];
      const init2CallTime = init2.mock.invocationCallOrder[0];
      const init3CallTime = init3.mock.invocationCallOrder[0];
      
      expect(init1CallTime).toBeLessThan(init2CallTime);
      expect(init2CallTime).toBeLessThan(init3CallTime);
    });
    
    test('should initialize components in priority order when no dependencies', async () => {
      // Arrange
      const component1 = 'test.component1';
      const component2 = 'test.component2';
      const component3 = 'test.component3';
      
      const init1 = jest.fn().mockResolvedValue({ status: 'ready' });
      const init2 = jest.fn().mockResolvedValue({ status: 'ready' });
      const init3 = jest.fn().mockResolvedValue({ status: 'ready' });
      
      registerComponent(component1, {
        initFunction: init1,
        dependencies: [],
        priority: 80
      });
      
      registerComponent(component2, {
        initFunction: init2,
        dependencies: [],
        priority: 100
      });
      
      registerComponent(component3, {
        initFunction: init3,
        dependencies: [],
        priority: 90
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(init1).toHaveBeenCalled();
      expect(init2).toHaveBeenCalled();
      expect(init3).toHaveBeenCalled();
      
      // Check initialization order based on priority
      const init1CallTime = init1.mock.invocationCallOrder[0];
      const init2CallTime = init2.mock.invocationCallOrder[0];
      const init3CallTime = init3.mock.invocationCallOrder[0];
      
      expect(init2CallTime).toBeLessThan(init3CallTime); // component2 has highest priority
      expect(init3CallTime).toBeLessThan(init1CallTime); // component3 has second highest
    });
    
    test('should prioritize accessibility components', async () => {
      // Arrange
      const a11yComponent = 'a11y.component';
      const regularComponent = 'regular.component';
      
      const a11yInit = jest.fn().mockResolvedValue({ status: 'ready' });
      const regularInit = jest.fn().mockResolvedValue({ status: 'ready' });
      
      registerComponent(regularComponent, {
        initFunction: regularInit,
        dependencies: [],
        priority: 100,
        accessibility: false
      });
      
      registerComponent(a11yComponent, {
        initFunction: a11yInit,
        dependencies: [],
        priority: 90, // Lower base priority
        accessibility: true // But marked as accessibility
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(a11yInit).toHaveBeenCalled();
      expect(regularInit).toHaveBeenCalled();
      
      // Check that a11y component was initialized first despite lower priority
      const a11yCallTime = a11yInit.mock.invocationCallOrder[0];
      const regularCallTime = regularInit.mock.invocationCallOrder[0];
      
      expect(a11yCallTime).toBeLessThan(regularCallTime);
    });
    
    test('should handle initialization failures', async () => {
      // Arrange
      const component1 = 'test.component1';
      const component2 = 'test.component2';
      
      const init1 = jest.fn().mockResolvedValue({ status: 'ready' });
      const init2 = jest.fn().mockRejectedValue(new Error('Initialization failed'));
      
      registerComponent(component1, {
        initFunction: init1,
        dependencies: [],
        priority: 100
      });
      
      registerComponent(component2, {
        initFunction: init2,
        dependencies: [],
        priority: 90
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(init1).toHaveBeenCalled();
      expect(init2).toHaveBeenCalled();
      
      const status = getInitializationStatus();
      expect(status.components[component1].status).toBe('ready');
      expect(status.components[component2].status).toBe('failed');
      expect(status.components[component2].error).toBeDefined();
      
      expect(isInitializationSuccessful()).toBe(false);
    });
    
    test('should handle circular dependencies', async () => {
      // Arrange
      const component1 = 'test.component1';
      const component2 = 'test.component2';
      
      const init1 = jest.fn().mockResolvedValue({ status: 'ready' });
      const init2 = jest.fn().mockResolvedValue({ status: 'ready' });
      
      registerComponent(component1, {
        initFunction: init1,
        dependencies: [component2],
        priority: 100
      });
      
      registerComponent(component2, {
        initFunction: init2,
        dependencies: [component1],
        priority: 90
      });
      
      // Act & Assert
      await expect(initializeSystem()).rejects.toThrow();
      
      // Neither component should be initialized due to circular dependency
      expect(init1).not.toHaveBeenCalled();
      expect(init2).not.toHaveBeenCalled();
    });
  });

  describe('Component Status Tracking', () => {
    test('should track component initialization progress', async () => {
      // Arrange
      const componentId = 'test.component';
      let progressCallback = null;
      
      const initFunction = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          // Simulate progress updates
          if (progressCallback) {
            progressCallback(25, 'starting');
            setTimeout(() => progressCallback(50, 'loading'), 10);
            setTimeout(() => progressCallback(75, 'configuring'), 20);
            setTimeout(() => progressCallback(100, 'finalizing'), 30);
          }
          
          setTimeout(() => resolve({ status: 'ready' }), 50);
        });
      });
      
      registerComponent(componentId, {
        initFunction,
        dependencies: [],
        priority: 100,
        onProgress: (progress, phase) => {
          progressCallback(progress, phase);
        }
      });
      
      // Capture progress updates
      const progressUpdates = [];
      progressCallback = (progress, phase) => {
        progressUpdates.push({ progress, phase });
      };
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(progressUpdates.length).toBeGreaterThanOrEqual(4);
      expect(progressUpdates[0].progress).toBe(25);
      expect(progressUpdates[0].phase).toBe('starting');
      expect(progressUpdates[3].progress).toBe(100);
      expect(progressUpdates[3].phase).toBe('finalizing');
      
      const componentStatus = getComponentStatus(componentId);
      expect(componentStatus.progress).toBe(100);
      expect(componentStatus.phase).toBe('finalizing');
    });
    
    test('should log initialization events', async () => {
      // Arrange
      const componentId = 'test.component';
      
      const initFunction = jest.fn().mockResolvedValue({ status: 'ready' });
      
      registerComponent(componentId, {
        initFunction,
        dependencies: [],
        priority: 100
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(logInitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'start',
          componentId
        })
      );
      
      expect(logInitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          componentId
        })
      );
    });
    
    test('should publish initialization events', async () => {
      // Arrange
      const componentId = 'test.component';
      
      const initFunction = jest.fn().mockResolvedValue({ status: 'ready' });
      
      registerComponent(componentId, {
        initFunction,
        dependencies: [],
        priority: 100
      });
      
      // Act
      await initializeSystem();
      
      // Assert
      expect(publishEvent).toHaveBeenCalledWith(
        'component:init:start',
        expect.objectContaining({
          componentId
        })
      );
      
      expect(publishEvent).toHaveBeenCalledWith(
        'component:init:complete',
        expect.objectContaining({
          componentId,
          success: true
        })
      );
    });
  });
});
