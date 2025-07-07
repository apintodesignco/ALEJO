/**
 * Progressive Loading Integration Test Suite
 * 
 * Tests the integration between the Progressive Loading Manager, 
 * Initialization Manager, and Fallback Manager to ensure they work
 * together properly in a production-like environment.
 */

import { 
  initializeProgressiveLoading,
  getLoadingSequenceState,
  generateLoadingReport,
  loadDeferredComponents,
  updateUserPreferences
} from '../../../src/core/system/progressive-loading-manager.js';

import {
  registerComponent,
  unregisterComponent,
  initializeSystem,
  getInitializationStatus
} from '../../../src/core/system/initialization-manager.js';

import {
  registerFallbackImplementation,
  getFallbackImplementation,
  executePrimaryWithFallback,
  getFallbackStatistics
} from '../../../src/core/system/fallback-manager.js';

// Mock the event bus
jest.mock('../../../src/core/events/event-bus.js', () => ({
  publishEvent: jest.fn(),
  subscribeToEvent: jest.fn(),
  unsubscribeFromEvent: jest.fn()
}));

describe('Progressive Loading Integration', () => {
  // Reset all modules before each test
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    
    // Clear any registered components
    const registeredComponents = getInitializationStatus().componentStatus || {};
    Object.keys(registeredComponents).forEach(componentId => {
      unregisterComponent(componentId);
    });
    
    // Reset user preferences
    updateUserPreferences({
      prioritizeAccessibility: true,
      resourceConstraints: 'balanced',
      deferNonEssential: true
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('End-to-End Initialization Flow', () => {
    test('should initialize components in correct phases based on accessibility and priority', async () => {
      // Arrange - Register components with different priorities and accessibility flags
      registerComponent({
        id: 'core.accessibility',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 100,
        isAccessibility: true,
        isEssential: true
      });
      
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isAccessibility: false,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.accessibility',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 70,
        isAccessibility: true,
        isEssential: false
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 50,
        isAccessibility: false,
        isEssential: false
      });
      
      // Act - Initialize progressive loading and system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert - Check loading phases
      const loadingState = getLoadingSequenceState();
      
      // Accessibility components should be in phase 1
      expect(loadingState.phases[1]).toContain('core.accessibility');
      
      // Essential components should be in phase 2
      expect(loadingState.phases[2]).toContain('core.essential');
      
      // Non-essential accessibility components should be in phase 3
      expect(loadingState.phases[3]).toContain('feature.accessibility');
      
      // Non-essential, non-accessibility components should be in phase 4 or deferred
      expect(loadingState.phases[4]).toContain('feature.nonessential');
      
      // Check initialization order
      const status = getInitializationStatus();
      const initOrder = status.initializationOrder;
      
      // Accessibility should be initialized before non-accessibility
      const accessibilityIndex = initOrder.indexOf('core.accessibility');
      const essentialIndex = initOrder.indexOf('core.essential');
      expect(accessibilityIndex).toBeLessThan(essentialIndex);
    });
    
    test('should defer non-essential components when resource constraints are high', async () => {
      // Arrange - Set high resource constraints
      updateUserPreferences({
        prioritizeAccessibility: true,
        resourceConstraints: 'high',
        deferNonEssential: true
      });
      
      // Register components
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isAccessibility: false,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 50,
        isAccessibility: false,
        isEssential: false
      });
      
      // Act - Initialize progressive loading and system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert
      const loadingState = getLoadingSequenceState();
      
      // Essential components should be initialized
      expect(loadingState.initializedComponents).toContain('core.essential');
      
      // Non-essential components should be deferred
      expect(loadingState.deferredComponents).toContain('feature.nonessential');
      
      // Check initialization status
      const status = getInitializationStatus();
      expect(status.componentStatus['core.essential'].isInitialized).toBe(true);
      expect(status.componentStatus['feature.nonessential'].isInitialized).toBe(false);
    });
    
    test('should load deferred components when explicitly requested', async () => {
      // Arrange - Set high resource constraints
      updateUserPreferences({
        prioritizeAccessibility: true,
        resourceConstraints: 'high',
        deferNonEssential: true
      });
      
      // Register components
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true
      });
      
      const nonEssentialInit = jest.fn().mockResolvedValue(true);
      registerComponent({
        id: 'feature.nonessential',
        initialize: nonEssentialInit,
        priority: 50,
        isEssential: false
      });
      
      // Act - Initialize system with progressive loading
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Verify non-essential component is deferred
      expect(getLoadingSequenceState().deferredComponents).toContain('feature.nonessential');
      expect(nonEssentialInit).not.toHaveBeenCalled();
      
      // Now load deferred components
      await loadDeferredComponents();
      
      // Assert
      expect(nonEssentialInit).toHaveBeenCalled();
      expect(getLoadingSequenceState().initializedComponents).toContain('feature.nonessential');
      expect(getLoadingSequenceState().deferredComponents).not.toContain('feature.nonessential');
    });
  });

  describe('Fallback Integration', () => {
    test('should use fallbacks for failed components while respecting loading phases', async () => {
      // Arrange - Register components with a failing one
      registerComponent({
        id: 'core.working',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 100,
        isEssential: true
      });
      
      registerComponent({
        id: 'core.failing',
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        priority: 90,
        isEssential: true
      });
      
      // Register fallback for failing component
      const fallbackImplementation = jest.fn().mockResolvedValue(true);
      registerFallbackImplementation('core.failing', fallbackImplementation);
      
      // Act - Initialize system with progressive loading
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert
      const status = getInitializationStatus();
      const fallbackStats = getFallbackStatistics();
      
      // Both components should be considered initialized
      expect(status.componentStatus['core.working'].isInitialized).toBe(true);
      expect(status.componentStatus['core.failing'].isInitialized).toBe(true);
      
      // Fallback should have been used
      expect(fallbackImplementation).toHaveBeenCalled();
      expect(fallbackStats.totalFallbacksUsed).toBe(1);
      expect(fallbackStats.componentFallbacks['core.failing'].used).toBe(true);
      
      // Check loading sequence state
      const loadingState = getLoadingSequenceState();
      expect(loadingState.initializedComponents).toContain('core.working');
      expect(loadingState.initializedComponents).toContain('core.failing');
      expect(loadingState.failedComponents).toContain('core.failing');
      expect(loadingState.fallbackComponents).toContain('core.failing');
    });
    
    test('should prioritize accessibility fallbacks when primary implementation fails', async () => {
      // Arrange - Register an accessibility component that will fail
      registerComponent({
        id: 'core.accessibility',
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        priority: 100,
        isAccessibility: true,
        isEssential: true
      });
      
      // Register a regular component
      registerComponent({
        id: 'feature.regular',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 50,
        isAccessibility: false,
        isEssential: false
      });
      
      // Register fallback for accessibility component
      const accessibilityFallback = jest.fn().mockResolvedValue(true);
      registerFallbackImplementation('core.accessibility', accessibilityFallback, { 
        preservesAccessibility: true 
      });
      
      // Act - Initialize system with progressive loading
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert
      const status = getInitializationStatus();
      const fallbackStats = getFallbackStatistics();
      
      // Accessibility component should be initialized with fallback
      expect(status.componentStatus['core.accessibility'].isInitialized).toBe(true);
      expect(accessibilityFallback).toHaveBeenCalled();
      
      // Fallback should be marked as preserving accessibility
      expect(fallbackStats.componentFallbacks['core.accessibility'].preservesAccessibility).toBe(true);
      
      // Check loading report
      const report = generateLoadingReport();
      expect(report.accessibilityStatus.preservedComponents).toContain('core.accessibility');
    });
  });

  describe('Loading Report Generation', () => {
    test('should generate comprehensive loading report with all component statuses', async () => {
      // Arrange - Register various components
      registerComponent({
        id: 'core.accessibility',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 100,
        isAccessibility: true,
        isEssential: true
      });
      
      registerComponent({
        id: 'core.failing',
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.deferred',
        initialize: jest.fn(),
        priority: 30,
        isEssential: false
      });
      
      // Register fallback
      registerFallbackImplementation('core.failing', jest.fn().mockResolvedValue(true));
      
      // Set resource constraints to defer non-essential components
      updateUserPreferences({
        resourceConstraints: 'high',
        deferNonEssential: true
      });
      
      // Act - Initialize system with progressive loading
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert - Generate and check report
      const report = generateLoadingReport();
      
      // Check basic structure
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('totalComponents');
      expect(report).toHaveProperty('initializedComponents');
      expect(report).toHaveProperty('failedComponents');
      expect(report).toHaveProperty('deferredComponents');
      expect(report).toHaveProperty('fallbackComponents');
      expect(report).toHaveProperty('accessibilityStatus');
      expect(report).toHaveProperty('resourceUsage');
      expect(report).toHaveProperty('phaseTimings');
      
      // Check component counts
      expect(report.totalComponents).toBe(3);
      expect(report.initializedComponents.length).toBe(2); // core.accessibility and core.failing (with fallback)
      expect(report.failedComponents.length).toBe(1); // core.failing
      expect(report.deferredComponents.length).toBe(1); // feature.deferred
      expect(report.fallbackComponents.length).toBe(1); // core.failing
      
      // Check specific components
      expect(report.initializedComponents).toContain('core.accessibility');
      expect(report.initializedComponents).toContain('core.failing');
      expect(report.failedComponents).toContain('core.failing');
      expect(report.deferredComponents).toContain('feature.deferred');
      expect(report.fallbackComponents).toContain('core.failing');
      
      // Check accessibility status
      expect(report.accessibilityStatus.totalAccessibilityComponents).toBe(1);
      expect(report.accessibilityStatus.initializedAccessibilityComponents).toBe(1);
    });
  });

  describe('User Preference Adaptation', () => {
    test('should adapt loading strategy when user preferences change', async () => {
      // Arrange - Register components
      registerComponent({
        id: 'core.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 50,
        isEssential: false
      });
      
      // Set initial preferences to defer non-essential
      updateUserPreferences({
        resourceConstraints: 'high',
        deferNonEssential: true
      });
      
      // Act - Initialize progressive loading
      await initializeProgressiveLoading();
      
      // Check initial state - should defer non-essential
      let loadingState = getLoadingSequenceState();
      expect(loadingState.deferredComponents).toContain('feature.nonessential');
      
      // Update preferences to load all components
      updateUserPreferences({
        resourceConstraints: 'low',
        deferNonEssential: false
      });
      
      // Re-initialize progressive loading
      await initializeProgressiveLoading();
      
      // Assert - Should no longer defer non-essential
      loadingState = getLoadingSequenceState();
      expect(loadingState.deferredComponents).not.toContain('feature.nonessential');
      expect(loadingState.phases[4]).toContain('feature.nonessential');
    });
  });
});
