/**
 * Monitoring Dashboard Test Suite
 * 
 * Tests the functionality of the monitoring dashboard including:
 * - Dashboard initialization and rendering
 * - Component status display
 * - Fallback usage statistics
 * - Progressive loading visualization
 * - Accessibility features
 */

import { 
  openMonitoringDashboard,
  closeMonitoringDashboard,
  updateDashboard,
  getDashboardState,
  toggleHighContrastMode,
  getAccessibilityStatus
} from '../../../src/core/system/monitoring-dashboard.js';

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
  getLoadingSequenceState
} from '../../../src/core/system/progressive-loading-manager.js';

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

describe('Monitoring Dashboard', () => {
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

  describe('Dashboard Initialization', () => {
    test('should create dashboard elements when opened', () => {
      // Act
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      expect(dashboard.style.display).not.toBe('none');
      expect(dashboard.innerHTML).toContain('Initialization Status');
      expect(dashboard.innerHTML).toContain('Component Status');
      expect(dashboard.innerHTML).toContain('Fallback Usage');
      expect(dashboard.innerHTML).toContain('Progressive Loading');
    });
    
    test('should close dashboard when closeMonitoringDashboard is called', () => {
      // Arrange
      openMonitoringDashboard();
      
      // Act
      closeMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      expect(dashboard.style.display).toBe('none');
    });
    
    test('should have proper ARIA attributes for accessibility', () => {
      // Act
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      
      // Check for ARIA role
      expect(dashboard.getAttribute('role')).toBe('dialog');
      
      // Check for ARIA label
      expect(dashboard.getAttribute('aria-labelledby')).toBeTruthy();
      
      // Check for close button with proper ARIA
      const closeButton = dashboard.querySelector('[aria-label="Close dashboard"]');
      expect(closeButton).toBeTruthy();
      
      // Check for tab navigation
      const tabbableElements = dashboard.querySelectorAll('button, [tabindex="0"]');
      expect(tabbableElements.length).toBeGreaterThan(0);
    });
  });

  describe('Component Status Display', () => {
    test('should display registered components and their status', async () => {
      // Arrange - Register components
      registerComponent({
        id: 'core.component1',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 100
      });
      
      registerComponent({
        id: 'core.component2',
        initialize: jest.fn().mockRejectedValue(new Error('Failed')),
        priority: 90
      });
      
      // Act - Initialize system and open dashboard
      await initializeSystem();
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      const componentSection = dashboard.querySelector('.component-status-section');
      
      expect(componentSection.innerHTML).toContain('core.component1');
      expect(componentSection.innerHTML).toContain('core.component2');
      
      // Check for success indicator
      expect(componentSection.innerHTML).toContain('success-indicator');
      
      // Check for error indicator
      expect(componentSection.innerHTML).toContain('error-indicator');
    });
    
    test('should update component status when system state changes', async () => {
      // Arrange - Register a component
      const initializeMock = jest.fn().mockResolvedValue(true);
      registerComponent({
        id: 'core.component',
        initialize: initializeMock,
        priority: 100
      });
      
      // Open dashboard before initialization
      openMonitoringDashboard();
      
      // Initial state should show pending
      let dashboard = document.getElementById('alejo-monitoring-dashboard');
      expect(dashboard.innerHTML).toContain('pending-indicator');
      
      // Act - Initialize system
      await initializeSystem();
      updateDashboard();
      
      // Assert - Should now show success
      dashboard = document.getElementById('alejo-monitoring-dashboard');
      expect(dashboard.innerHTML).toContain('success-indicator');
      expect(dashboard.innerHTML).not.toContain('pending-indicator');
    });
  });

  describe('Fallback Usage Statistics', () => {
    test('should display fallback usage statistics', async () => {
      // Arrange - Register components with fallbacks
      registerComponent({
        id: 'core.failing',
        initialize: jest.fn().mockRejectedValue(new Error('Failed')),
        priority: 100
      });
      
      const fallbackImplementation = jest.fn().mockResolvedValue(true);
      registerFallbackImplementation('core.failing', fallbackImplementation);
      
      // Act - Initialize system and open dashboard
      await initializeSystem();
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      const fallbackSection = dashboard.querySelector('.fallback-usage-section');
      
      expect(fallbackSection.innerHTML).toContain('core.failing');
      expect(fallbackSection.innerHTML).toContain('1'); // 1 fallback used
    });
    
    test('should display detailed fallback information when available', async () => {
      // Arrange - Register component with fallback that has metadata
      registerComponent({
        id: 'core.accessibility',
        initialize: jest.fn().mockRejectedValue(new Error('Failed')),
        priority: 100,
        isAccessibility: true
      });
      
      registerFallbackImplementation('core.accessibility', jest.fn().mockResolvedValue(true), {
        preservesAccessibility: true,
        performance: 'reduced',
        description: 'Simplified accessibility implementation'
      });
      
      // Act - Initialize system and open dashboard
      await initializeSystem();
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      const fallbackSection = dashboard.querySelector('.fallback-usage-section');
      
      expect(fallbackSection.innerHTML).toContain('core.accessibility');
      expect(fallbackSection.innerHTML).toContain('Preserves Accessibility: Yes');
      expect(fallbackSection.innerHTML).toContain('Performance: reduced');
      expect(fallbackSection.innerHTML).toContain('Simplified accessibility implementation');
    });
  });

  describe('Progressive Loading Visualization', () => {
    test('should display loading phases and component assignments', async () => {
      // Arrange - Register components with different priorities
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
        isEssential: true
      });
      
      registerComponent({
        id: 'feature.nonessential',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 50,
        isEssential: false
      });
      
      // Act - Initialize progressive loading, system, and open dashboard
      await initializeProgressiveLoading();
      await initializeSystem();
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      const loadingSection = dashboard.querySelector('.progressive-loading-section');
      
      // Should show phases
      expect(loadingSection.innerHTML).toContain('Phase 1');
      expect(loadingSection.innerHTML).toContain('Phase 2');
      
      // Should show components in phases
      expect(loadingSection.innerHTML).toContain('core.accessibility');
      expect(loadingSection.innerHTML).toContain('core.essential');
      expect(loadingSection.innerHTML).toContain('feature.nonessential');
    });
    
    test('should display deferred components section when components are deferred', async () => {
      // Arrange - Set up for deferred loading
      registerComponent({
        id: 'feature.deferred',
        initialize: jest.fn(),
        priority: 30,
        isEssential: false
      });
      
      // Act - Initialize with deferred components
      await initializeProgressiveLoading();
      const loadingState = getLoadingSequenceState();
      loadingState.deferredComponents = ['feature.deferred']; // Simulate deferred component
      
      openMonitoringDashboard();
      
      // Assert
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      expect(dashboard.innerHTML).toContain('Deferred Components');
      expect(dashboard.innerHTML).toContain('feature.deferred');
      expect(dashboard.innerHTML).toContain('Load Deferred Components');
    });
    
    test('should have a working "Load Deferred Components" button', async () => {
      // Arrange - Mock the loadDeferredComponents function
      const loadDeferredComponentsMock = jest.fn();
      jest.mock('../../../src/core/system/progressive-loading-manager.js', () => ({
        ...jest.requireActual('../../../src/core/system/progressive-loading-manager.js'),
        loadDeferredComponents: loadDeferredComponentsMock,
        getLoadingSequenceState: () => ({
          deferredComponents: ['feature.deferred']
        })
      }));
      
      // Act - Open dashboard
      openMonitoringDashboard();
      
      // Find and click the button
      const loadButton = document.querySelector('button[data-action="load-deferred"]');
      loadButton.click();
      
      // Assert
      expect(loadDeferredComponentsMock).toHaveBeenCalled();
    });
  });

  describe('Accessibility Features', () => {
    test('should toggle high contrast mode', () => {
      // Arrange
      openMonitoringDashboard();
      
      // Initial state should be normal contrast
      const initialState = getDashboardState();
      expect(initialState.highContrastMode).toBe(false);
      
      // Act - Toggle high contrast mode
      toggleHighContrastMode();
      
      // Assert
      const newState = getDashboardState();
      expect(newState.highContrastMode).toBe(true);
      
      // Check that high-contrast class is applied
      const dashboard = document.getElementById('alejo-monitoring-dashboard');
      expect(dashboard.classList.contains('high-contrast')).toBe(true);
    });
    
    test('should provide screen reader announcements for important events', async () => {
      // Arrange - Create a mock for screen reader announcements
      const announceToScreenReader = jest.fn();
      jest.mock('../../../src/core/accessibility/screen-reader.js', () => ({
        announceToScreenReader
      }));
      
      // Register a component that will fail
      registerComponent({
        id: 'core.failing',
        initialize: jest.fn().mockRejectedValue(new Error('Failed')),
        priority: 100
      });
      
      // Act - Initialize system which should trigger announcements
      await initializeSystem();
      
      // Assert
      expect(announceToScreenReader).toHaveBeenCalledWith(
        expect.stringContaining('initialization failed'),
        'assertive'
      );
    });
    
    test('should report accessibility status of initialization', async () => {
      // Arrange - Register accessibility components
      registerComponent({
        id: 'core.accessibility1',
        initialize: jest.fn().mockResolvedValue(true),
        priority: 100,
        isAccessibility: true
      });
      
      registerComponent({
        id: 'core.accessibility2',
        initialize: jest.fn().mockRejectedValue(new Error('Failed')),
        priority: 90,
        isAccessibility: true
      });
      
      // Register fallback that preserves accessibility
      registerFallbackImplementation('core.accessibility2', jest.fn().mockResolvedValue(true), {
        preservesAccessibility: true
      });
      
      // Act - Initialize system
      await initializeSystem();
      
      // Assert
      const accessibilityStatus = getAccessibilityStatus();
      
      expect(accessibilityStatus.totalAccessibilityComponents).toBe(2);
      expect(accessibilityStatus.initializedAccessibilityComponents).toBe(2);
      expect(accessibilityStatus.failedAccessibilityComponents).toBe(1);
      expect(accessibilityStatus.preservedComponents).toContain('core.accessibility2');
    });
  });
});
