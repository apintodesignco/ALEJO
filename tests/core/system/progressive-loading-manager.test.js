/**
 * Progressive Loading Manager Test Suite
 * 
 * Tests the functionality of the progressive loading manager including:
 * - Loading phase assignment
 * - Accessibility prioritization
 * - Resource-aware loading
 * - Deferred component handling
 * - Loading sequence state tracking
 */

import { 
  initializeProgressiveLoading,
  getLoadingSequenceState,
  generateLoadingReport,
  loadDeferredComponents,
  updateUserPreferences
} from '../../../src/core/system/progressive-loading-manager.js';

// Mock dependencies
import { getInitializationStatus } from '../../../src/core/system/initialization-manager.js';
import { getResourceStatus } from '../../../src/performance/resource-allocation-manager.js';
import { logInitEvent } from '../../../src/core/system/initialization-log-viewer.js';
import { publishEvent } from '../../../src/core/event-bus.js';

// Mock the dependencies
jest.mock('../../../src/core/system/initialization-manager.js', () => ({
  getInitializationStatus: jest.fn()
}));

jest.mock('../../../src/performance/resource-allocation-manager.js', () => ({
  getResourceStatus: jest.fn()
}));

jest.mock('../../../src/core/system/initialization-log-viewer.js', () => ({
  logInitEvent: jest.fn()
}));

jest.mock('../../../src/core/event-bus.js', () => ({
  publishEvent: jest.fn()
}));

describe('Progressive Loading Manager', () => {
  // Reset mocks and state before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    getInitializationStatus.mockReturnValue({
      components: {},
      componentCount: 0,
      completedComponents: [],
      pendingComponents: [],
      failedComponents: []
    });
    
    getResourceStatus.mockReturnValue({
      memory: { available: 1000, total: 2000 },
      cpu: { available: 80, total: 100 },
      network: { available: 5, total: 10 },
      battery: { level: 80, charging: false }
    });
  });

  describe('Loading Phase Assignment', () => {
    test('should assign components to appropriate phases based on priority', async () => {
      // Arrange
      const mockComponents = {
        'a11y.component': {
          id: 'a11y.component',
          accessibility: true,
          isEssential: true,
          priority: 1000,
          dependencies: []
        },
        'core.component': {
          id: 'core.component',
          accessibility: false,
          isEssential: true,
          priority: 800,
          dependencies: []
        },
        'standard.component': {
          id: 'standard.component',
          accessibility: false,
          isEssential: false,
          priority: 600,
          dependencies: []
        },
        'enhanced.component': {
          id: 'enhanced.component',
          accessibility: false,
          isEssential: false,
          priority: 400,
          dependencies: []
        },
        'optional.component': {
          id: 'optional.component',
          accessibility: false,
          isEssential: false,
          priority: 200,
          dependencies: []
        }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 5,
        completedComponents: [],
        pendingComponents: Object.keys(mockComponents),
        failedComponents: []
      });
      
      // Act
      await initializeProgressiveLoading();
      const state = getLoadingSequenceState();
      
      // Assert
      expect(state.phases).toBeDefined();
      expect(Object.keys(state.phases).length).toBe(5); // 5 phases
      
      // Check phase assignments
      expect(state.componentPhases['a11y.component']).toBe('critical');
      expect(state.componentPhases['core.component']).toBe('core');
      expect(state.componentPhases['standard.component']).toBe('standard');
      expect(state.componentPhases['enhanced.component']).toBe('enhanced');
      expect(state.componentPhases['optional.component']).toBe('optional');
      
      // Check that events were published
      expect(publishEvent).toHaveBeenCalledWith(
        'loading:phase:assigned',
        expect.objectContaining({
          componentId: 'a11y.component',
          phase: 'critical'
        })
      );
    });
    
    test('should prioritize accessibility components regardless of priority', async () => {
      // Arrange
      const mockComponents = {
        'a11y.lowPriority': {
          id: 'a11y.lowPriority',
          accessibility: true,
          isEssential: false,
          priority: 100, // Low priority
          dependencies: []
        },
        'core.highPriority': {
          id: 'core.highPriority',
          accessibility: false,
          isEssential: true,
          priority: 900, // High priority
          dependencies: []
        }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 2,
        completedComponents: [],
        pendingComponents: Object.keys(mockComponents),
        failedComponents: []
      });
      
      // Act
      await initializeProgressiveLoading();
      const state = getLoadingSequenceState();
      
      // Assert
      expect(state.componentPhases['a11y.lowPriority']).toBe('critical');
      expect(state.componentPhases['core.highPriority']).toBe('core');
    });
    
    test('should respect dependencies when assigning phases', async () => {
      // Arrange
      const mockComponents = {
        'a11y.base': {
          id: 'a11y.base',
          accessibility: true,
          isEssential: true,
          priority: 1000,
          dependencies: []
        },
        'core.dependent': {
          id: 'core.dependent',
          accessibility: false,
          isEssential: true,
          priority: 900,
          dependencies: ['a11y.base'] // Depends on a11y component
        },
        'standard.dependent': {
          id: 'standard.dependent',
          accessibility: false,
          isEssential: false,
          priority: 700,
          dependencies: ['core.dependent'] // Depends on core component
        }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 3,
        completedComponents: [],
        pendingComponents: Object.keys(mockComponents),
        failedComponents: []
      });
      
      // Act
      await initializeProgressiveLoading();
      const state = getLoadingSequenceState();
      
      // Assert
      expect(state.componentPhases['a11y.base']).toBe('critical');
      expect(state.componentPhases['core.dependent']).toBe('core');
      expect(state.componentPhases['standard.dependent']).toBe('standard');
      
      // Check loading order
      expect(state.loadingOrder.indexOf('a11y.base')).toBeLessThan(
        state.loadingOrder.indexOf('core.dependent')
      );
      
      expect(state.loadingOrder.indexOf('core.dependent')).toBeLessThan(
        state.loadingOrder.indexOf('standard.dependent')
      );
    });
  });

  describe('Resource-Aware Loading', () => {
    test('should defer non-essential components when resources are constrained', async () => {
      // Arrange
      const mockComponents = {
        'a11y.essential': {
          id: 'a11y.essential',
          accessibility: true,
          isEssential: true,
          priority: 1000,
          dependencies: []
        },
        'core.essential': {
          id: 'core.essential',
          accessibility: false,
          isEssential: true,
          priority: 800,
          dependencies: []
        },
        'standard.nonEssential': {
          id: 'standard.nonEssential',
          accessibility: false,
          isEssential: false,
          priority: 600,
          dependencies: []
        },
        'optional.nonEssential': {
          id: 'optional.nonEssential',
          accessibility: false,
          isEssential: false,
          priority: 200,
          dependencies: []
        }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 4,
        completedComponents: [],
        pendingComponents: Object.keys(mockComponents),
        failedComponents: []
      });
      
      // Simulate constrained resources
      getResourceStatus.mockReturnValue({
        memory: { available: 200, total: 2000 }, // Low memory
        cpu: { available: 20, total: 100 }, // Low CPU
        network: { available: 1, total: 10 }, // Low network
        battery: { level: 15, charging: false } // Low battery
      });
      
      // Act
      await initializeProgressiveLoading({
        userPreferences: {
          resourceConservationMode: true
        }
      });
      const state = getLoadingSequenceState();
      const report = generateLoadingReport();
      
      // Assert
      expect(state.deferredComponents).toContain('optional.nonEssential');
      expect(report.deferredComponents).toBe(1);
      
      // Essential components should not be deferred
      expect(state.deferredComponents).not.toContain('a11y.essential');
      expect(state.deferredComponents).not.toContain('core.essential');
    });
    
    test('should load all components when resources are abundant', async () => {
      // Arrange
      const mockComponents = {
        'a11y.component': { id: 'a11y.component', accessibility: true, isEssential: true, priority: 1000, dependencies: [] },
        'core.component': { id: 'core.component', accessibility: false, isEssential: true, priority: 800, dependencies: [] },
        'optional.component': { id: 'optional.component', accessibility: false, isEssential: false, priority: 200, dependencies: [] }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 3,
        completedComponents: [],
        pendingComponents: Object.keys(mockComponents),
        failedComponents: []
      });
      
      // Simulate abundant resources
      getResourceStatus.mockReturnValue({
        memory: { available: 1800, total: 2000 },
        cpu: { available: 90, total: 100 },
        network: { available: 9, total: 10 },
        battery: { level: 95, charging: true }
      });
      
      // Act
      await initializeProgressiveLoading();
      const state = getLoadingSequenceState();
      
      // Assert
      expect(state.deferredComponents.length).toBe(0);
    });
    
    test('should respect user preferences for resource conservation', async () => {
      // Arrange
      const mockComponents = {
        'a11y.component': { id: 'a11y.component', accessibility: true, isEssential: true, priority: 1000, dependencies: [] },
        'core.component': { id: 'core.component', accessibility: false, isEssential: true, priority: 800, dependencies: [] },
        'optional.component': { id: 'optional.component', accessibility: false, isEssential: false, priority: 200, dependencies: [] }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 3,
        completedComponents: [],
        pendingComponents: Object.keys(mockComponents),
        failedComponents: []
      });
      
      // Simulate moderate resources
      getResourceStatus.mockReturnValue({
        memory: { available: 1000, total: 2000 },
        cpu: { available: 60, total: 100 },
        network: { available: 5, total: 10 },
        battery: { level: 50, charging: false }
      });
      
      // Act - with resource conservation enabled
      await initializeProgressiveLoading({
        userPreferences: {
          resourceConservationMode: true,
          loadOptionalComponents: false
        }
      });
      const conservationState = getLoadingSequenceState();
      
      // Reset for second test
      jest.clearAllMocks();
      
      // Act - with resource conservation disabled
      await initializeProgressiveLoading({
        userPreferences: {
          resourceConservationMode: false,
          loadOptionalComponents: true
        }
      });
      const normalState = getLoadingSequenceState();
      
      // Assert
      expect(conservationState.deferredComponents).toContain('optional.component');
      expect(normalState.deferredComponents).not.toContain('optional.component');
    });
  });

  describe('Loading Sequence State', () => {
    test('should track loading sequence state correctly', async () => {
      // Arrange
      const mockComponents = {
        'a11y.component': { id: 'a11y.component', accessibility: true, isEssential: true, priority: 1000, dependencies: [] },
        'core.component': { id: 'core.component', accessibility: false, isEssential: true, priority: 800, dependencies: [] }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 2,
        completedComponents: [],
        pendingComponents: Object.keys(mockComponents),
        failedComponents: []
      });
      
      // Act
      await initializeProgressiveLoading();
      const initialState = getLoadingSequenceState();
      
      // Simulate component completion
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 2,
        completedComponents: ['a11y.component'],
        pendingComponents: ['core.component'],
        failedComponents: []
      });
      
      // Update state based on initialization status
      await initializeProgressiveLoading({ updateOnly: true });
      const updatedState = getLoadingSequenceState();
      
      // Assert
      expect(initialState.currentPhase).toBe('critical');
      expect(updatedState.completedPhases).toContain('critical');
      expect(updatedState.currentPhase).toBe('core');
    });
    
    test('should generate accurate loading report', async () => {
      // Arrange
      const mockComponents = {
        'a11y.component1': { id: 'a11y.component1', accessibility: true, isEssential: true, priority: 1000, dependencies: [], status: 'ready' },
        'a11y.component2': { id: 'a11y.component2', accessibility: true, isEssential: true, priority: 900, dependencies: [], status: 'failed' },
        'core.component': { id: 'core.component', accessibility: false, isEssential: true, priority: 800, dependencies: [], status: 'ready' },
        'standard.component': { id: 'standard.component', accessibility: false, isEssential: false, priority: 600, dependencies: [], status: 'pending' }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 4,
        completedComponents: ['a11y.component1', 'core.component'],
        pendingComponents: ['standard.component'],
        failedComponents: ['a11y.component2']
      });
      
      // Act
      await initializeProgressiveLoading();
      const report = generateLoadingReport();
      
      // Assert
      expect(report.totalComponents).toBe(4);
      expect(report.loadedComponents).toBe(2);
      expect(report.failedComponents).toBe(1);
      expect(report.pendingComponents).toBe(1);
      
      expect(report.accessibilityStats.total).toBe(2);
      expect(report.accessibilityStats.loaded).toBe(1);
      expect(report.accessibilityStats.failed).toBe(1);
      
      expect(report.essentialStats.total).toBe(3);
      expect(report.essentialStats.loaded).toBe(2);
      expect(report.essentialStats.failed).toBe(1);
      
      expect(report.phaseStats.critical.componentCount).toBe(2);
      expect(report.phaseStats.critical.loadedCount).toBe(1);
      expect(report.phaseStats.core.componentCount).toBe(1);
      expect(report.phaseStats.core.loadedCount).toBe(1);
    });
  });

  describe('Deferred Component Loading', () => {
    test('should load deferred components when requested', async () => {
      // Arrange
      const mockComponents = {
        'a11y.component': { id: 'a11y.component', accessibility: true, isEssential: true, priority: 1000, dependencies: [] },
        'optional.component': { id: 'optional.component', accessibility: false, isEssential: false, priority: 200, dependencies: [] }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 2,
        completedComponents: ['a11y.component'],
        pendingComponents: ['optional.component'],
        failedComponents: []
      });
      
      // Simulate constrained resources to cause deferral
      getResourceStatus.mockReturnValue({
        memory: { available: 200, total: 2000 },
        cpu: { available: 20, total: 100 },
        battery: { level: 15, charging: false }
      });
      
      // Act - initialize with resource conservation
      await initializeProgressiveLoading({
        userPreferences: {
          resourceConservationMode: true
        }
      });
      
      const initialState = getLoadingSequenceState();
      expect(initialState.deferredComponents).toContain('optional.component');
      
      // Simulate improved resources
      getResourceStatus.mockReturnValue({
        memory: { available: 1500, total: 2000 },
        cpu: { available: 80, total: 100 },
        battery: { level: 50, charging: true }
      });
      
      // Act - load deferred components
      await loadDeferredComponents();
      const updatedState = getLoadingSequenceState();
      
      // Assert
      expect(updatedState.deferredComponents.length).toBe(0);
      expect(logInitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deferred-loading',
          componentId: 'optional.component'
        })
      );
    });
    
    test('should update user preferences', async () => {
      // Arrange
      const mockComponents = {
        'a11y.component': { id: 'a11y.component', accessibility: true, isEssential: true, priority: 1000, dependencies: [] },
        'optional.component': { id: 'optional.component', accessibility: false, isEssential: false, priority: 200, dependencies: [] }
      };
      
      getInitializationStatus.mockReturnValue({
        components: mockComponents,
        componentCount: 2,
        completedComponents: [],
        pendingComponents: Object.keys(mockComponents),
        failedComponents: []
      });
      
      // Act - initialize with default preferences
      await initializeProgressiveLoading();
      const initialState = getLoadingSequenceState();
      
      // Update preferences
      await updateUserPreferences({
        prioritizeAccessibility: true,
        resourceConservationMode: true,
        loadOptionalComponents: false
      });
      
      // Re-initialize with updated preferences
      await initializeProgressiveLoading({ updateOnly: true });
      const updatedState = getLoadingSequenceState();
      
      // Assert
      expect(updatedState.userPreferences.resourceConservationMode).toBe(true);
      expect(updatedState.userPreferences.loadOptionalComponents).toBe(false);
      expect(updatedState.deferredComponents).toContain('optional.component');
    });
  });
});
