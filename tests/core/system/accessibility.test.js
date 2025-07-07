/**
 * Accessibility Test Suite for Initialization System
 * 
 * Tests the accessibility features of the initialization system:
 * - Prioritization of accessibility components
 * - High contrast mode support
 * - Screen reader compatibility
 * - Keyboard navigation
 * - Fallback preservation of accessibility
 */

import { 
  registerComponent,
  unregisterComponent,
  initializeSystem,
  getInitializationStatus
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
  generateTimelineVisualization,
  getTimelineStyles
} from '../../../src/core/system/initialization-log-viewer.js';

import {
  openMonitoringDashboard,
  closeMonitoringDashboard,
  toggleHighContrastMode,
  getAccessibilityStatus
} from '../../../src/core/system/monitoring-dashboard.js';

// Mock DOM elements
document.body.innerHTML = `
  <div id="alejo-monitoring-dashboard"></div>
  <div id="alejo-dashboard-container"></div>
`;

// Mock the event bus
jest.mock('../../../src/core/events/event-bus.js', () => ({
  publishEvent: jest.fn(),
  subscribeToEvent: jest.fn(),
  unsubscribeFromEvent: jest.fn()
}));

// Mock screen reader announcements
jest.mock('../../../src/core/accessibility/screen-reader.js', () => ({
  announceToScreenReader: jest.fn()
}));

// Import the mocked screen reader
import { announceToScreenReader } from '../../../src/core/accessibility/screen-reader.js';

describe('Initialization System Accessibility', () => {
  // Reset all modules before each test
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    
    // Reset DOM
    document.getElementById('alejo-monitoring-dashboard').innerHTML = '';
    document.getElementById('alejo-dashboard-container').innerHTML = '';
    
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

  describe('Accessibility Component Prioritization', () => {
    test('should initialize accessibility components first', async () => {
      // Arrange - Register components with different priorities and accessibility flags
      const accessibilityInit = jest.fn().mockResolvedValue(true);
      const normalInit = jest.fn().mockResolvedValue(true);
      
      registerComponent({
        id: 'normal.component',
        initialize: normalInit,
        priority: 90,
        isAccessibility: false
      });
      
      registerComponent({
        id: 'accessibility.component',
        initialize: accessibilityInit,
        priority: 80, // Lower base priority but should be boosted
        isAccessibility: true
      });
      
      // Act - Initialize system
      await initializeProgressiveLoading();
      await initializeSystem();
      
      // Assert - Check initialization order
      expect(accessibilityInit.mock.invocationCallOrder[0])
        .toBeLessThan(normalInit.mock.invocationCallOrder[0]);
    });
    
    test('should never defer accessibility components even in minimal mode', async () => {
      // Arrange - Register components
      registerComponent({
        id: 'accessibility.component',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 60,
        isAccessibility: true
      });
      
      registerComponent({
        id: 'normal.essential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 80,
        isEssential: true,
        isAccessibility: false
      });
      
      // Act - Initialize with minimal resources
      await initializeProgressiveLoading({ resourceMode: 'minimal' });
      await initializeSystem();
      
      // Assert
      const loadingState = getLoadingSequenceState();
      const initStatus = getInitializationStatus();
      
      // Accessibility component should be initialized
      expect(initStatus.componentStatus['accessibility.component'].status).toBe('initialized');
      
      // Accessibility component should not be in deferred list
      expect(loadingState.deferredComponents).not.toContain('accessibility.component');
      
      // Non-accessibility component might be deferred in minimal mode
      expect(loadingState.deferredComponents).toContain('normal.essential');
    });
  });

  describe('Fallback Accessibility Preservation', () => {
    test('should prioritize fallbacks that preserve accessibility', async () => {
      // Arrange - Register an accessibility component with multiple fallbacks
      registerComponent({
        id: 'accessibility.component',
        initialize: jest.fn().mockRejectedValue(new Error('Failed')),
        priority: 90,
        isAccessibility: true
      });
      
      // Register fallbacks with different accessibility preservation
      const preservingFallback = jest.fn().mockResolvedValue(true);
      const nonPreservingFallback = jest.fn().mockResolvedValue(true);
      
      registerFallbackImplementation('accessibility.component', nonPreservingFallback, {
        id: 'fallback1',
        preservesAccessibility: false,
        priority: 100 // Higher priority but doesn't preserve accessibility
      });
      
      registerFallbackImplementation('accessibility.component', preservingFallback, {
        id: 'fallback2',
        preservesAccessibility: true,
        priority: 90 // Lower priority but preserves accessibility
      });
      
      // Act - Initialize system
      await initializeSystem();
      
      // Assert - Preserving fallback should be chosen despite lower priority
      expect(preservingFallback).toHaveBeenCalled();
      expect(nonPreservingFallback).not.toHaveBeenCalled();
    });
    
    test('should track and report accessibility preservation status', async () => {
      // Arrange - Register accessibility components with fallbacks
      registerComponent({
        id: 'accessibility.success',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90,
        isAccessibility: true
      });
      
      registerComponent({
        id: 'accessibility.failure',
        initialize: jest.fn().mockRejectedValue(new Error('Failed')),
        priority: 80,
        isAccessibility: true
      });
      
      registerFallbackImplementation('accessibility.failure', jest.fn().mockResolvedValue(true), {
        preservesAccessibility: true
      });
      
      // Act - Initialize system
      await initializeSystem();
      
      // Open dashboard to calculate accessibility status
      openMonitoringDashboard();
      
      // Assert
      const accessibilityStatus = getAccessibilityStatus();
      
      expect(accessibilityStatus.totalAccessibilityComponents).toBe(2);
      expect(accessibilityStatus.initializedAccessibilityComponents).toBe(2);
      expect(accessibilityStatus.failedAccessibilityComponents).toBe(1);
      expect(accessibilityStatus.preservedComponents).toContain('accessibility.failure');
    });
  });

  describe('High Contrast Mode', () => {
    test('should properly toggle high contrast mode', () => {
      // Arrange
      openMonitoringDashboard();
      
      // Act - Toggle high contrast mode
      const result = toggleHighContrastMode();
      
      // Assert
      expect(result).toBe(true);
      
      // Dashboard should have high contrast class
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      expect(dashboard.classList.contains('high-contrast')).toBe(true);
      
      // High contrast styles should be added to document
      const styleElement = document.getElementById('alejo-high-contrast-styles');
      expect(styleElement).toBeTruthy();
      expect(styleElement.textContent).toContain('background: #000');
    });
    
    test('should announce high contrast mode changes to screen readers', () => {
      // Arrange
      openMonitoringDashboard();
      
      // Act - Toggle high contrast mode
      toggleHighContrastMode();
      
      // Assert - Check that screen reader announcement was created
      // We can't directly test the announcement element as it's removed after a timeout
      // But we can check that the announcement function was called if available
      if (typeof announceToScreenReader === 'function') {
        expect(announceToScreenReader).toHaveBeenCalledWith(
          expect.stringContaining('High contrast mode enabled'),
          expect.any(String)
        );
      }
      
      // Toggle back
      toggleHighContrastMode();
      
      if (typeof announceToScreenReader === 'function') {
        expect(announceToScreenReader).toHaveBeenCalledWith(
          expect.stringContaining('High contrast mode disabled'),
          expect.any(String)
        );
      }
    });
    
    test('should apply high contrast styles to timeline visualization', () => {
      // Arrange
      const timelineData = [
        { componentId: 'comp1', startTime: 0, endTime: 100, status: 'success' },
        { componentId: 'comp2', startTime: 20, endTime: 120, status: 'error' }
      ];
      
      // Act - Generate timeline visualization with high contrast
      const normalVisualization = generateTimelineVisualization(timelineData);
      
      // Enable high contrast mode
      openMonitoringDashboard();
      toggleHighContrastMode();
      
      // Generate visualization again
      const highContrastVisualization = generateTimelineVisualization(timelineData);
      
      // Assert
      expect(normalVisualization).not.toBe(highContrastVisualization);
      expect(highContrastVisualization).toContain('high-contrast');
      
      // Get timeline styles
      const styles = getTimelineStyles();
      expect(styles).toContain('high-contrast');
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support keyboard navigation in monitoring dashboard', () => {
      // Arrange
      openMonitoringDashboard();
      
      // Assert - Check for proper ARIA roles and keyboard navigation attributes
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      
      // Check for ARIA role
      expect(dashboard.getAttribute('role')).toBeTruthy();
      
      // Check for tabbable elements
      const tabbableElements = dashboard.querySelectorAll('button, [tabindex="0"]');
      expect(tabbableElements.length).toBeGreaterThan(0);
      
      // Check for close button with keyboard access
      const closeButton = dashboard.querySelector('#alejo-dashboard-close');
      expect(closeButton).toBeTruthy();
      expect(closeButton.getAttribute('aria-label')).toBeTruthy();
    });
  });

  describe('Screen Reader Support', () => {
    test('should include proper ARIA attributes in dashboard', () => {
      // Arrange
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      
      // Check for ARIA attributes
      expect(dashboard.getAttribute('role')).toBeTruthy();
      expect(dashboard.getAttribute('aria-label') || 
             dashboard.getAttribute('aria-labelledby')).toBeTruthy();
      
      // Check for section headings
      const headings = dashboard.querySelectorAll('h1, h2, h3, h4, h5, h6');
      expect(headings.length).toBeGreaterThan(0);
    });
    
    test('should include accessible status indicators', async () => {
      // Arrange - Register components with different statuses
      registerComponent({
        id: 'test.success',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 90
      });
      
      registerComponent({
        id: 'test.failure',
        initialize: jest.fn().mockRejectedValue(new Error('Failed')),
        priority: 80
      });
      
      // Act - Initialize system and open dashboard
      await initializeSystem();
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      
      // Check for status indicators with proper ARIA attributes
      const statusIndicators = dashboard.querySelectorAll('.status-normal, .status-warning, .status-error');
      expect(statusIndicators.length).toBeGreaterThan(0);
      
      // Status indicators should have accessible text or aria-label
      statusIndicators.forEach(indicator => {
        const hasAccessibleText = indicator.textContent.trim().length > 0 ||
                                 indicator.getAttribute('aria-label') ||
                                 indicator.getAttribute('title');
        expect(hasAccessibleText).toBe(true);
      });
    });
  });

  describe('Resource Constraints and Accessibility', () => {
    test('should maintain accessibility even under minimal resources', async () => {
      // Arrange - Register components
      registerComponent({
        id: 'accessibility.component',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 60,
        isAccessibility: true
      });
      
      registerComponent({
        id: 'normal.component',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 80,
        isAccessibility: false
      });
      
      // Act - Initialize with minimal resources
      await initializeProgressiveLoading({ resourceMode: 'minimal' });
      await initializeSystem();
      
      // Assert
      const initStatus = getInitializationStatus();
      
      // Accessibility component should be initialized
      expect(initStatus.componentStatus['accessibility.component'].status).toBe('initialized');
    });
    
    test('should prioritize accessibility components when loading deferred components', async () => {
      // Arrange - Register components with accessibility flags
      const accessibilityInit = jest.fn().mockResolvedValue(true);
      const normalInit = jest.fn().mockResolvedValue(true);
      
      registerComponent({
        id: 'deferred.accessibility',
        initialize: accessibilityInit,
        priority: 40,
        isAccessibility: true,
        isEssential: false
      });
      
      registerComponent({
        id: 'deferred.normal',
        initialize: normalInit,
        priority: 50, // Higher priority but not accessibility
        isAccessibility: false,
        isEssential: false
      });
      
      // Act - Initialize with conservative resources to defer non-essential components
      await initializeProgressiveLoading({ resourceMode: 'conservative' });
      await initializeSystem({ deferNonEssential: true });
      
      // Load deferred components
      await loadDeferredComponents();
      
      // Assert - Check initialization order
      expect(accessibilityInit.mock.invocationCallOrder[0])
        .toBeLessThan(normalInit.mock.invocationCallOrder[0]);
    });
  });
});
