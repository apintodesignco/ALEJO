/**
 * ALEJO System Monitoring Dashboard
 * 
 * Provides a visual interface for monitoring system health, component status,
 * resource usage, and error logs. Designed with accessibility as a priority.
 * 
 * Enhanced with high contrast mode and comprehensive accessibility features.
 * Provides detailed visualization of initialization process, component status,
 * fallback usage statistics, and progressive loading sequence.
 */

import { getComponentStatus, getErrorLog } from './error-handler.js';
import { 
  getInitializationStatus, 
  isInitializationSuccessful 
} from './initialization-manager.js';
import { generateRegistrationReport } from './component-registration-validator.js';
import { generateTimelineVisualization, getTimelineStyles } from './initialization-log-viewer.js';
import { getLoadingSequenceState, generateLoadingReport } from './progressive-loading-manager.js';
import { getFallbackStatistics } from './fallback-manager.js';

// Dashboard state
let dashboardElement = null;
let isVisible = false;
let updateInterval = null;
let highContrastMode = false;

// Dashboard container ID
const DASHBOARD_CONTAINER_ID = 'alejo-dashboard-container';
const DASHBOARD_ID = 'alejo-monitoring-dashboard';

// Dashboard sections
const sections = {
  overview: true,
  components: true,
  resources: true,
  errors: true,
  registration: true,
  settings: true
};

/**
 * Initialize the monitoring dashboard
 * 
 * @param {Object} options - Dashboard options
 * @param {HTMLElement} options.container - Container element (creates one if not provided)
 * @param {boolean} options.autoShow - Whether to show dashboard immediately
 * @param {number} options.updateInterval - Update interval in ms (default: 2000)
 * @param {Object} options.sections - Which sections to show (default: all)
 * @returns {HTMLElement} - The dashboard element
 */
export function initDashboard(options = {}) {
  const {
    container = null,
    autoShow = false,
    updateInterval: interval = 2000,
    sections: sectionOptions = {}
  } = options;
  
  // Update section visibility
  Object.assign(sections, sectionOptions);
  
  // Create dashboard element if it doesn't exist
  if (!dashboardElement) {
    dashboardElement = document.createElement('div');
    dashboardElement.id = 'alejo-monitoring-dashboard';
    dashboardElement.setAttribute('role', 'region');
    dashboardElement.setAttribute('aria-label', 'ALEJO System Monitoring Dashboard');
    dashboardElement.className = 'alejo-dashboard';
    
    // Apply basic styles
    dashboardElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      max-height: 80vh;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      overflow: auto;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 10000;
      display: none;
      color: #333;
    `;
    
    // Add status indicator styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .status-normal { color: #28a745; }
      .status-warning { color: #ffc107; }
      .status-error { color: #dc3545; }
      .status-normal-bg { background-color: #28a745; }
      .status-warning-bg { background-color: #ffc107; }
      .status-error-bg { background-color: #dc3545; }
    `;
    document.head.appendChild(styleElement);
    
    // Create dashboard structure
    dashboardElement.innerHTML = `
      <div class="alejo-dashboard-header" style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; font-size: 16px; font-weight: 600;">ALEJO System Monitor</h2>
        <div>
          <button id="alejo-dashboard-refresh" aria-label="Refresh dashboard" style="background: none; border: none; cursor: pointer; padding: 4px;">
            🔄
          </button>
          <button id="alejo-dashboard-close" aria-label="Close dashboard" style="background: none; border: none; cursor: pointer; padding: 4px;">
            ✕
          </button>
        </div>
      </div>
      <div class="alejo-dashboard-content" style="padding: 12px;">
        <div id="alejo-dashboard-overview" class="alejo-dashboard-section" style="margin-bottom: 16px;"></div>
        <div id="alejo-dashboard-components" class="dashboard-section"></div>
        <div id="alejo-dashboard-initialization" class="dashboard-section"></div>
        <div id="alejo-dashboard-loading" class="dashboard-section"></div>
        <div id="alejo-dashboard-fallbacks" class="dashboard-section"></div>
        <div id="alejo-dashboard-registration" class="dashboard-section"></div>
        <div id="alejo-dashboard-settings" class="dashboard-section"></div>
        <div id="alejo-dashboard-resources" class="alejo-dashboard-section" style="margin-bottom: 16px;"></div>
        <div id="alejo-dashboard-errors" class="alejo-dashboard-section"></div>
      </div>
    `;
    
    // Add event listeners
    dashboardElement.querySelector('#alejo-dashboard-refresh').addEventListener('click', () => {
      updateDashboard();
    });
    
    dashboardElement.querySelector('#alejo-dashboard-close').addEventListener('click', () => {
      hideDashboard();
    });
    
    // Add to container or body
    const targetContainer = container || document.body;
    targetContainer.appendChild(dashboardElement);
  }
  
  // Show dashboard if requested
  if (autoShow) {
    showDashboard();
  }
  
  // Set up update interval
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  updateInterval = setInterval(() => {
    updateOverviewSection();
    updateComponentsSection();
    updateInitializationSection();
    updateLoadingSection();
    updateFallbacksSection();
    updateRegistrationValidationSection();
  }, interval);
  
  return dashboardElement;
}

/**
 * Show the monitoring dashboard
 */
export function showDashboard() {
  if (!dashboardElement) {
    initDashboard();
  }
  
  dashboardElement.style.display = 'block';
  isVisible = true;
  updateDashboard();
  
  // Announce for screen readers
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.style.position = 'absolute';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  announcement.textContent = 'ALEJO System Monitoring Dashboard is now open';
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 3000);
}

/**
 * Hide the monitoring dashboard
 */
export function hideDashboard() {
  if (dashboardElement) {
    dashboardElement.style.display = 'none';
    isVisible = false;
  }
}

/**
 * Toggle dashboard visibility
 */
export function toggleDashboard() {
  if (isVisible) {
    hideDashboard();
  } else {
    showDashboard();
  }
}

/**
 * Update the dashboard with current system information
 */
export function updateDashboard() {
  if (!dashboardElement || !isVisible) return;
  
  // Update each section if visible
  if (sections.overview) {
    updateOverviewSection();
  }
  
  if (sections.components) {
    updateComponentsSection();
  }
  
  if (sections.initialization) {
    updateInitializationSection();
  }
  
  if (sections.loading) {
    updateLoadingSection();
  }
  
  if (sections.fallbacks) {
    updateFallbacksSection();
  }
  
  if (sections.registration) {
    updateRegistrationValidationSection();
  }
  
  if (sections.settings) {
    updateSettingsSection();
  }
  
  if (sections.errors) {
    updateErrorsSection();
  }
}

/**
 * Update the overview section
 */
function updateOverviewSection() {
  const overviewSection = dashboardElement.querySelector('#alejo-dashboard-overview');
  if (!overviewSection) return;
  
  // Get initialization status
  const initStatus = getInitializationStatus();
  
  // Get resource mode
  let resourceMode, resourceUsage;
  try {
    // Use dynamic import to avoid circular dependencies
    import('../../performance/resource-allocation-manager.js').then(module => {
      const resourceManager = module.getResourceAllocationManager();
      resourceMode = resourceManager.getCurrentMode();
      resourceUsage = resourceManager.getResourceUsage();
      updateOverviewDisplay(overviewSection, initStatus, resourceMode, resourceUsage);
    }).catch(err => {
      console.error('Failed to import resource manager:', err);
      updateOverviewDisplay(overviewSection, initStatus, 'Unknown', null);
    });
  } catch (err) {
    console.error('Failed to import resource manager:', err);
    updateOverviewDisplay(overviewSection, initStatus, 'Unknown', null);
  }
}

/**
 * Update overview display with system status information
 * @param {HTMLElement} overviewSection - The overview section element
 * @param {Object} initStatus - Initialization status
 * @param {string} resourceMode - Current resource mode
 * @param {Object} resourceUsage - Resource usage information
 */
function updateOverviewDisplay(overviewSection, initStatus, resourceMode, resourceUsage) {
  // Determine system status
  let statusClass = 'status-normal';
  let statusText = 'Normal';
  let statusDetails = [];
  
  // Check initialization status
  const initializationSuccessful = isInitializationSuccessful();
  
  // Check for critical errors
  const hasEssentialFailures = initStatus.failedComponents.some(comp => 
    comp.isEssential || comp.accessibility
  );
  
  // Check for accessibility component failures
  const hasAccessibilityFailures = initStatus.failedComponents.some(comp => 
    comp.accessibility
  );
  
  // Check if initialization is still in progress
  const isInitializing = initStatus.isInitializing;
  
  // Check resource status
  const highCpuUsage = resourceUsage && resourceUsage.cpu && resourceUsage.cpu >= 80;
  const highMemoryUsage = resourceUsage && resourceUsage.memory && resourceUsage.memory >= 85;
  const highTemperature = resourceUsage && resourceUsage.temperature && resourceUsage.temperature >= 80;
  const lowBattery = resourceUsage && resourceUsage.batteryLevel && resourceUsage.batteryLevel <= 15 && !resourceUsage.isCharging;
  
  // Check if user has manually set a resource mode
  let userConfiguredMode = null;
  try {
    const savedSettings = JSON.parse(localStorage.getItem('alejo_resource_thresholds'));
    if (savedSettings && savedSettings.resourceMode && savedSettings.resourceMode !== 'auto') {
      userConfiguredMode = savedSettings.resourceMode;
    }
  } catch (e) {
    console.warn('Failed to load resource mode from settings:', e);
  }
  
  // Use user-configured mode if available
  const effectiveResourceMode = userConfiguredMode || resourceMode;
  
  // Calculate accessibility status
  const totalAccessibilityComponents = initStatus.accessibilityComponents?.length || 0;
  const activeAccessibilityComponents = initStatus.accessibilityComponents?.filter(
    comp => comp.status === 'initialized' || comp.status === 'fallback'
  ).length || 0;
  
  const accessibilityPercentage = totalAccessibilityComponents > 0 ?
    Math.round((activeAccessibilityComponents / totalAccessibilityComponents) * 100) : 100;
  
  const accessibilityStatus = hasAccessibilityFailures ? 'Degraded' : 
    (accessibilityPercentage === 100 ? 'Fully Available' : 'Partially Available');
  
  const accessibilityStatusClass = hasAccessibilityFailures ? 'status-error' : 
    (accessibilityPercentage === 100 ? 'status-normal' : 'status-warning');
    
  // Determine overall status
  if (isInitializing) {
    statusClass = 'status-info';
    statusText = 'Initializing';
    statusDetails.push(`Initializing components (${initStatus.completedComponents.length}/${initStatus.completedComponents.length + initStatus.pendingComponents.length})`);
  } else if (hasEssentialFailures) {
    statusClass = 'status-error';
    statusText = 'Critical Error';
    statusDetails.push('Essential components failed');
  } else if (hasAccessibilityFailures) {
    statusClass = 'status-error';
    statusText = 'Accessibility Error';
    statusDetails.push('Accessibility components failed');
  } else if (highTemperature) {
    statusClass = 'status-error';
    statusText = 'Overheating';
    statusDetails.push('System temperature critical');
  } else if (initStatus.failedComponents.length > 0) {
    statusClass = 'status-warning';
    statusText = 'Degraded';
    statusDetails.push(`${initStatus.failedComponents.length} components failed`);
  } else if (highCpuUsage || highMemoryUsage) {
    statusClass = 'status-warning';
    statusText = 'High Resource Usage';
    if (highCpuUsage) statusDetails.push('CPU usage high');
    if (highMemoryUsage) statusDetails.push('Memory usage high');
  } else if (lowBattery) {
    statusClass = 'status-warning';
    statusText = 'Low Battery';
    statusDetails.push('Battery level low');
  } else if (effectiveResourceMode === 'conservative' || effectiveResourceMode === 'minimal') {
    statusClass = 'status-warning';
    statusText = 'Limited Resources';
    statusDetails.push(`Running in ${effectiveResourceMode} mode`);
  } else if (!initializationSuccessful) {
    statusClass = 'status-warning';
    statusText = 'Initialization Issues';
    statusDetails.push('Some components failed to initialize');
  } else {
    statusClass = 'status-normal';
    statusText = 'Normal';
    statusDetails.push('All systems operational');
  }
  
  // Format last updated time
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  
  overviewSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">System Overview</h3>
    
    <div style="margin-bottom: 12px; padding: 8px; border-radius: 4px;" class="${statusClass === 'status-error' ? 'status-error-bg' : statusClass === 'status-warning' ? 'status-warning-bg' : 'status-normal-bg'}" style="opacity: 0.15;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div style="font-weight: 500; color: white;">Status:</div>
        <div style="font-weight: 600; color: white;">${statusText}</div>
      </div>
      ${statusDetails.length > 0 ? 
        `<div style="font-size: 11px; color: white;">${statusDetails.join(', ')}</div>` : 
        ''}
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Resource Mode:</div>
      <div>
        <strong>${effectiveResourceMode || 'Unknown'}</strong>
        ${userConfiguredMode ? '<span style="font-size: 10px; color: #666; margin-left: 4px;">(User configured)</span>' : ''}
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Accessibility:</div>
      <div class="${accessibilityStatusClass}">${accessibilityStatus} (${accessibilityPercentage}%)</div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Components:</div>
      <div>${initStatus.completedComponents.length} active / ${initStatus.failedComponents.length} failed / ${initStatus.pendingComponents.length} pending</div>
    </div>
    
    <div style="display: flex; justify-content: space-between;">
      <div>Last Updated:</div>
      <div>${new Date().toLocaleTimeString()}</div>
    </div>
  `;
  
  // Add status styles
  const style = document.createElement('style');
  style.textContent = `
    .status-normal { color: #2e7d32; }
    .status-warning { color: #f57c00; }
    .status-error { color: #d32f2f; }
  `;
  overviewSection.appendChild(style);
}

/**
 * Update the components section
 */
function updateComponentsSection() {
  const componentsSection = dashboardElement.querySelector('#alejo-dashboard-components');
  if (!componentsSection) return;
  
  // Get component status from error handler
  const componentStatus = getComponentStatus();
  
  // Get initialization status directly from imported function
  const initStatus = getInitializationStatus();
  
  // Update the component display
  updateComponentDisplay(componentsSection, componentStatus, initStatus);
}

/**
 * Update component display with status information
 * @param {HTMLElement} componentsSection - The components section element
 * @param {Object} componentStatus - Component status from error handler
 * @param {Object} initStatus - Initialization status from initialization manager
 */
function updateComponentDisplay(componentsSection, componentStatus, initStatus) {
  // Merge status information from both sources
  const mergedStatus = {};
  
  // Process component status
  Object.entries(componentStatus).forEach(([id, status]) => {
    mergedStatus[id] = {
      ...status,
      initProgress: initStatus[id]?.progress || 0,
      initPhase: initStatus[id]?.phase || 'unknown',
      dependencies: initStatus[id]?.dependencies || [],
      isAccessibility: status.accessibility || false,
      isEssential: status.isEssential || false
    };
  });
  
  // Add any components from init status that aren't in component status
  Object.entries(initStatus).forEach(([id, status]) => {
    if (!mergedStatus[id]) {
      mergedStatus[id] = {
        status: status.status || 'unknown',
        initProgress: status.progress || 0,
        initPhase: status.phase || 'unknown',
        dependencies: status.dependencies || [],
        isAccessibility: status.accessibility || false,
        isEssential: status.isEssential || false,
        startTime: status.startTime || null,
        endTime: status.endTime || null,
        usingFallback: status.usingFallback || false
      };
    }
  });
  
  // Sort components: accessibility first, then essential, then by status (failed first), then alphabetically
  const sortedEntries = Object.entries(mergedStatus).sort((a, b) => {
    // Accessibility components first
    if (a[1].isAccessibility && !b[1].isAccessibility) return -1;
    if (!a[1].isAccessibility && b[1].isAccessibility) return 1;
    
    // Then essential components
    if (a[1].isEssential && !b[1].isEssential) return -1;
    if (!a[1].isEssential && b[1].isEssential) return 1;
    
    // Then failed components
    if (a[1].status === 'failed' && b[1].status !== 'failed') return -1;
    if (a[1].status !== 'failed' && b[1].status === 'failed') return 1;
    
    // Then initializing components
    if (a[1].status === 'initializing' && b[1].status !== 'initializing') return -1;
    if (a[1].status !== 'initializing' && b[1].status === 'initializing') return 1;
    
    // Then alphabetically
    return a[0].localeCompare(b[0]);
  });
  
  // Calculate overall initialization progress
  const totalComponents = sortedEntries.length;
  const initializedComponents = sortedEntries.filter(([_, status]) => 
    status.status === 'initialized' || status.status === 'fallback'
  ).length;
  const failedComponents = sortedEntries.filter(([_, status]) => 
    status.status === 'failed'
  ).length;
  
  const overallProgress = totalComponents > 0 ? 
    Math.round((initializedComponents / totalComponents) * 100) : 0;
  
  componentsSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Component Status</h3>
    
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div>Initialization Progress:</div>
        <div>${initializedComponents}/${totalComponents} (${overallProgress}%)</div>
      </div>
      ${createProgressBar(overallProgress, failedComponents > 0 ? 'status-warning' : 'status-normal')}
    </div>
    
    <div style="max-height: 200px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;" aria-label="Component status table">
        <thead>
          <tr>
            <th style="text-align: left; padding: 4px; border-bottom: 1px solid #eee;">Component</th>
            <th style="text-align: left; padding: 4px; border-bottom: 1px solid #eee;">Status</th>
            <th style="text-align: left; padding: 4px; border-bottom: 1px solid #eee;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${sortedEntries.length === 0 ? 
            '<tr><td colspan="3" style="text-align: center; padding: 8px;">No components registered</td></tr>' : 
            sortedEntries.map(([id, status]) => {
              const statusClass = getStatusClass(status.status);
              const accessibilityBadge = status.isAccessibility ? 
                '<span class="badge badge-a11y" aria-label="Accessibility component">A11Y</span>' : '';
              const essentialBadge = status.isEssential ? 
                '<span class="badge badge-core" aria-label="Core component">CORE</span>' : '';
              const fallbackBadge = status.usingFallback ? 
                '<span class="badge badge-fallback" aria-label="Using fallback implementation">FALLBACK</span>' : '';
              
              // Format initialization time if available
              let timeInfo = '';
              if (status.endTime) {
                const duration = status.endTime - status.startTime;
                timeInfo = `<div class="component-time">Initialized in ${duration}ms</div>`;
              } else if (status.startTime) {
                const elapsed = Date.now() - status.startTime;
                timeInfo = `<div class="component-time">Initializing for ${elapsed}ms</div>`;
              }
              
              // Show dependency info for waiting components
              let dependencyInfo = '';
              if (status.status === 'initializing' && status.dependencies && status.dependencies.length > 0) {
                const pendingDeps = status.dependencies.filter(dep => 
                  !mergedStatus[dep] || mergedStatus[dep].status !== 'initialized'
                );
                if (pendingDeps.length > 0) {
                  dependencyInfo = `<div class="component-deps">Waiting for: ${pendingDeps.join(', ')}</div>`;
                }
              }
              
              // Show detailed phase info
              let phaseInfo = '';
              if (status.initPhase && status.initPhase !== 'unknown') {
                phaseInfo = `<div class="component-phase">${status.initPhase}</div>`;
              }
              
              // Progress indicator
              let progressIndicator = '';
              if (status.status === 'initializing' && status.initProgress) {
                progressIndicator = `<div class="progress-mini">${createProgressBar(status.initProgress, 'status-info')}</div>`;
              }
              
              return `
                <tr>
                  <td style="padding: 4px; border-bottom: 1px solid #eee;">
                    <div class="component-name">${id}</div>
                    <div class="component-badges">${accessibilityBadge} ${essentialBadge} ${fallbackBadge}</div>
                  </td>
                  <td style="padding: 4px; border-bottom: 1px solid #eee;">
                    <span class="status-${statusClass}" aria-label="Component status: ${status.status}">${status.status}</span>
                    ${progressIndicator}
                  </td>
                  <td style="padding: 4px; border-bottom: 1px solid #eee;">
                    ${phaseInfo}
                    ${dependencyInfo}
                    ${timeInfo}
                  </td>
                </tr>
              `;
            }).join('')
          }
        </tbody>
      </table>
    </div>
  `;
  
  // Add status styles
  const style = document.createElement('style');
  style.textContent = `
    /* Status colors */
    .status-initialized { color: #2e7d32; }
    .status-fallback { color: #f57c00; }
    .status-failed { color: #d32f2f; }
    .status-initializing { color: #1976d2; }
    
    /* Component badges */
    .badge {
      display: inline-block;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 10px;
      margin-left: 4px;
      font-weight: 500;
    }
    .badge-a11y {
      background: #e3f2fd;
      color: #0d47a1;
    }
    .badge-core {
      background: #fce4ec;
      color: #c2185b;
    }
    .badge-fallback {
      background: #fff3e0;
      color: #e65100;
    }
    
    /* Component details */
    .component-name {
      font-weight: 500;
    }
    .component-badges {
      margin-top: 2px;
    }
    .component-time {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }
    .component-deps {
      font-size: 10px;
      color: #d32f2f;
      margin-top: 2px;
    }
    .component-phase {
      font-size: 10px;
      font-weight: 500;
      margin-top: 2px;
    }
    .progress-mini {
      margin-top: 4px;
      height: 4px;
    }
    
    /* High contrast mode support */
    @media (forced-colors: active) {
      .badge {
        border: 1px solid currentColor;
      }
      .status-error {
        border: 1px solid currentColor;
      }
      .status-warning {
        border: 1px solid currentColor;
      }
      .status-normal {
        border: 1px solid currentColor;
      }
    }
  `;
  componentsSection.appendChild(style);
}

/**
 * Update the registration validation section of the dashboard
 */
/**
 * Update the progressive loading section of the dashboard
 */
function updateLoadingSection() {
  const loadingSection = dashboardElement.querySelector('#alejo-dashboard-loading');
  if (!loadingSection) return;
  
  // Get loading sequence state and report
  const loadingState = getLoadingSequenceState();
  const loadingReport = generateLoadingReport();
  
  // Calculate overall loading progress
  const totalComponents = loadingReport.totalComponents;
  const loadedComponents = loadingReport.loadedComponents;
  const progress = totalComponents > 0 ? Math.round((loadedComponents / totalComponents) * 100) : 0;
  
  // Determine status class
  const statusClass = loadingReport.accessibilityStats.failed > 0 ? 'status-error' : 
                     loadingState.currentPhase ? 'status-info' : 
                     'status-normal';
  
  // Generate phase progress bars
  const phaseProgressBars = Object.entries(loadingReport.phaseStats)
    .map(([phaseName, stats]) => {
      const phaseProgress = stats.componentCount > 0 ? 
        Math.round((stats.loadedCount / stats.componentCount) * 100) : 0;
      
      const phaseStatusClass = stats.completed ? 'status-normal' : 
                              loadingState.currentPhase === phaseName ? 'status-info' : 
                              'status-warning';
      
      return `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <div style="font-size: 12px;">${stats.name}</div>
            <div style="font-size: 12px;">${stats.loadedCount}/${stats.componentCount} (${phaseProgress}%)</div>
          </div>
          ${createProgressBar(phaseProgress, phaseStatusClass)}
        </div>
      `;
    }).join('');
  
  // Generate HTML
  loadingSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Progressive Loading</h3>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
      <div>Status:</div>
      <div class="${statusClass}">
        ${loadingState.currentPhase ? `Loading ${loadingState.phases[loadingState.currentPhase].name}` : 'Complete'}
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
      <div>Overall Progress:</div>
      <div>${loadedComponents}/${totalComponents} components (${progress}%)</div>
    </div>
    ${createProgressBar(progress, statusClass)}
    
    <div style="margin: 12px 0;">
      <h4 style="margin: 8px 0; font-size: 13px; font-weight: 500;">Loading Phases</h4>
      ${phaseProgressBars}
    </div>
    
    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 12px;">
      <div>
        <div style="font-weight: 500;">Accessibility</div>
        <div class="${loadingReport.accessibilityStats.failed > 0 ? 'status-error' : 'status-normal'}">
          ${loadingReport.accessibilityStats.loaded}/${loadingReport.accessibilityStats.total}
        </div>
      </div>
      <div>
        <div style="font-weight: 500;">Essential</div>
        <div class="${loadingReport.essentialStats.failed > 0 ? 'status-error' : 'status-normal'}">
          ${loadingReport.essentialStats.loaded}/${loadingReport.essentialStats.total}
        </div>
      </div>
      <div>
        <div style="font-weight: 500;">Deferred</div>
        <div class="status-info">${loadingReport.deferredComponents}</div>
      </div>
    </div>
    
    ${loadingReport.deferredComponents > 0 ? `
      <div style="margin-top: 12px;">
        <button id="load-deferred-btn" class="dashboard-button">
          Load Deferred Components
        </button>
      </div>
    ` : ''}
  `;
  
  // Add event listener for load deferred button
  const loadDeferredBtn = loadingSection.querySelector('#load-deferred-btn');
  if (loadDeferredBtn) {
    loadDeferredBtn.addEventListener('click', () => {
      loadDeferredBtn.textContent = 'Loading...';
      loadDeferredBtn.disabled = true;
      
      // This would typically call a function to load deferred components
      // For now, we'll just update the UI after a delay
      setTimeout(() => {
        updateLoadingSection();
      }, 1000);
    });
  }
}

/**
 * Update the fallbacks section of the dashboard
 */
function updateFallbacksSection() {
  const fallbacksSection = dashboardElement.querySelector('#alejo-dashboard-fallbacks');
  if (!fallbacksSection) return;
  
  // Get fallback statistics
  const fallbackStats = getFallbackStatistics();
  
  // Determine status class
  const statusClass = fallbackStats.activeFallbacks > 0 ? 
                     (fallbackStats.stubImplementations > 0 ? 'status-warning' : 'status-info') : 
                     'status-normal';
  
  // Generate fallback component list
  const fallbackComponents = Object.entries(fallbackStats.componentStats || {})
    .filter(([, stats]) => stats.usageCount > 0)
    .map(([componentId, stats]) => {
      const isStub = stats.isStub;
      const isAccessible = stats.isAccessible;
      const lastUsed = stats.lastUsed ? new Date(stats.lastUsed).toLocaleTimeString() : 'N/A';
      
      return `
        <tr>
          <td>
            <div class="component-name">${componentId}</div>
            <div class="component-badges">
              ${isAccessible ? '<span class="badge badge-a11y">A11Y</span>' : ''}
              ${isStub ? '<span class="badge badge-warning">STUB</span>' : ''}
            </div>
          </td>
          <td>
            <div>${stats.usageCount} ${stats.usageCount === 1 ? 'time' : 'times'}</div>
            <div style="font-size: 11px; color: #666;">Last: ${lastUsed}</div>
          </td>
          <td>
            <button class="small-button view-details-btn" data-component-id="${componentId}">
              Details
            </button>
          </td>
        </tr>
      `;
    }).join('');
  
  // Generate HTML
  fallbacksSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Fallback Usage</h3>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
      <div>Status:</div>
      <div class="${statusClass}">
        ${fallbackStats.activeFallbacks > 0 ? 
          `${fallbackStats.activeFallbacks} components using fallbacks` : 
          'No fallbacks in use'}
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 12px;">
      <div>
        <div style="font-weight: 500;">Total Fallbacks</div>
        <div>${fallbackStats.totalFallbacks}</div>
      </div>
      <div>
        <div style="font-weight: 500;">Active</div>
        <div class="${fallbackStats.activeFallbacks > 0 ? 'status-warning' : 'status-normal'}">
          ${fallbackStats.activeFallbacks}
        </div>
      </div>
      <div>
        <div style="font-weight: 500;">Accessible</div>
        <div class="${fallbackStats.accessibleFallbacks > 0 ? 'status-info' : 'status-normal'}">
          ${fallbackStats.accessibleFallbacks}
        </div>
      </div>
    </div>
    
    ${fallbackStats.activeFallbacks > 0 ? `
      <div style="margin-top: 12px;">
        <table class="dashboard-table" style="width: 100%;">
          <thead>
            <tr>
              <th>Component</th>
              <th>Usage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${fallbackComponents}
          </tbody>
        </table>
      </div>
    ` : `
      <div style="padding: 16px; text-align: center; color: #666;">
        No components are currently using fallbacks
      </div>
    `}
  `;
  
  // Add event listeners for detail buttons
  const detailButtons = fallbacksSection.querySelectorAll('.view-details-btn');
  detailButtons.forEach(button => {
    button.addEventListener('click', () => {
      const componentId = button.getAttribute('data-component-id');
      const componentStats = fallbackStats.componentStats[componentId];
      
      // Show details in a modal or expandable section
      alert(`Fallback Details for ${componentId}:\n\n` +
            `Type: ${componentStats.isStub ? 'Stub Implementation' : 'Full Fallback'}\n` +
            `Accessibility Support: ${componentStats.isAccessible ? 'Yes' : 'No'}\n` +
            `Usage Count: ${componentStats.usageCount}\n` +
            `Last Used: ${new Date(componentStats.lastUsed).toLocaleString()}\n\n` +
            `Limitations:\n${componentStats.limitations.join('\n') || 'None specified'}\n\n` +
            `Capabilities:\n${componentStats.capabilities.join('\n') || 'None specified'}`);
    });
  });
}

/**
 * Update the initialization timeline section of the dashboard
 */
function updateInitializationSection() {
  const initSection = dashboardElement.querySelector('#alejo-dashboard-initialization');
  if (!initSection) return;
  
  // Get initialization status
  const initStatus = getInitializationStatus();
  const isInitializing = initStatus.isInitializing;
  const initSuccessful = isInitializationSuccessful();
  
  // Generate timeline visualization
  const timelineHtml = generateTimelineVisualization();
  const timelineStyles = getTimelineStyles();
  
  // Create initialization details
  const completedCount = initStatus.completedComponents?.length || 0;
  const failedCount = initStatus.failedComponents?.length || 0;
  const pendingCount = initStatus.pendingComponents?.length || 0;
  const totalCount = completedCount + failedCount + pendingCount;
  
  // Calculate overall progress
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  // Determine status class
  const statusClass = failedCount > 0 ? 'status-error' : 
                     isInitializing ? 'status-info' : 
                     initSuccessful ? 'status-normal' : 'status-warning';
  
  // Format timing information
  let timingInfo = '';
  if (initStatus.startTime) {
    const startTime = new Date(initStatus.startTime).toLocaleTimeString();
    if (initStatus.endTime) {
      const endTime = new Date(initStatus.endTime).toLocaleTimeString();
      const duration = initStatus.endTime - initStatus.startTime;
      timingInfo = `Started at ${startTime}, completed at ${endTime} (${duration}ms)`;
    } else {
      const elapsed = Date.now() - initStatus.startTime;
      timingInfo = `Started at ${startTime}, running for ${elapsed}ms`;
    }
  }
  
  // Generate HTML
  initSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Initialization Timeline</h3>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
      <div>Status:</div>
      <div class="${statusClass}">
        ${isInitializing ? 'Initializing' : initSuccessful ? 'Complete' : 'Completed with issues'}
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
      <div>Progress:</div>
      <div>${completedCount}/${totalCount} components (${progress}%)</div>
    </div>
    ${createProgressBar(progress, statusClass)}
    
    <div style="font-size: 12px; margin: 8px 0; color: #666;">
      ${timingInfo}
    </div>
    
    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 12px;">
      <div>
        <div style="font-weight: 500;">Completed</div>
        <div class="status-normal">${completedCount}</div>
      </div>
      <div>
        <div style="font-weight: 500;">Failed</div>
        <div class="status-error">${failedCount}</div>
      </div>
      <div>
        <div style="font-weight: 500;">Pending</div>
        <div class="status-info">${pendingCount}</div>
      </div>
    </div>
    
    <style>${timelineStyles}</style>
    ${timelineHtml}
    
    <div style="margin-top: 12px;">
      <button id="retry-initialization-btn" class="dashboard-button" ${!failedCount ? 'disabled' : ''}>
        Retry Failed Components
      </button>
    </div>
  `;
  
  // Add event listener for retry button
  const retryBtn = initSection.querySelector('#retry-initialization-btn');
  retryBtn.addEventListener('click', () => {
    retryBtn.textContent = 'Retrying...';
    retryBtn.disabled = true;
    
    // This would typically call a function to retry failed components
    // For now, we'll just update the UI after a delay
    setTimeout(() => {
      updateInitializationSection();
    }, 1000);
  });
}

/**
 * Update the registration validation section of the dashboard
 */
function updateRegistrationValidationSection() {
  const registrationSection = dashboardElement.querySelector('#alejo-dashboard-registration');
  if (!registrationSection) return;
  
  // Show loading state
  registrationSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Component Registration</h3>
    <div style="padding: 8px 0;">Loading registration data...</div>
  `;
  
  // Generate registration report
  generateRegistrationReport().then(report => {
    const registrationRate = report.registrationRate;
    const statusClass = registrationRate === 100 ? 'status-normal' : 
                        registrationRate >= 80 ? 'status-warning' : 'status-error';
    
    // Create missing components list
    const missingComponentsList = report.details.missing.length > 0 ?
      `<div style="margin-top: 8px;">
        <div style="font-weight: 500; margin-bottom: 4px;">Unregistered Components:</div>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px;">
          ${report.details.missing.map(id => `<li>${id}</li>`).join('')}
        </ul>
      </div>` : '';
    
    registrationSection.innerHTML = `
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Component Registration</h3>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div>Registration Rate:</div>
        <div class="${statusClass}">${report.registrationRate}%</div>
      </div>
      ${createProgressBar(report.registrationRate, statusClass)}
      
      <div style="margin-top: 12px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <div>Total Components:</div>
          <div>${report.totalComponents}</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <div>Registered:</div>
          <div>${report.registeredCount}</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <div>Unregistered:</div>
          <div>${report.missingCount}</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <div>Accessibility Components:</div>
          <div>${report.accessibilityCount}</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <div>Essential Components:</div>
          <div>${report.essentialCount}</div>
        </div>
      </div>
      
      ${missingComponentsList}
      
      <div style="margin-top: 12px;">
        <button id="validate-components-btn" class="dashboard-button">
          Validate Components
        </button>
      </div>
    `;
    
    // Add event listener for validate button
    const validateBtn = registrationSection.querySelector('#validate-components-btn');
    validateBtn.addEventListener('click', () => {
      validateBtn.textContent = 'Validating...';
      validateBtn.disabled = true;
      
      setTimeout(() => {
        updateRegistrationValidationSection();
      }, 1000);
    });
  }).catch(error => {
    console.error('Error generating registration report:', error);
    registrationSection.innerHTML = `
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Component Registration</h3>
      <div class="status-error">Error loading registration data</div>
    `;
  });
}

/**
 * Get CSS class for component status
 */
function getStatusClass(status) {
  switch (status) {
    case 'initialized': return 'initialized';
    case 'fallback': return 'fallback';
    case 'failed': return 'failed';
    case 'initializing': return 'initializing';
    default: return '';
  }
}

/**
 * Update the resources section
 */
function updateResourcesSection() {
  const resourcesSection = dashboardElement.querySelector('#alejo-dashboard-resources');
  if (!resourcesSection) return;
  
  // Import resource manager dynamically if needed
  try {
    // Use dynamic import to avoid circular dependencies
    import('../../performance/resource-allocation-manager.js').then(module => {
      const resourceManager = module.getResourceAllocationManager();
      updateResourceDisplay(resourcesSection, resourceManager);
    }).catch(err => {
      console.error('Failed to import resource manager:', err);
      updateResourceDisplayFallback(resourcesSection);
    });
  } catch (err) {
    console.error('Failed to import resource manager:', err);
    updateResourceDisplayFallback(resourcesSection);
  }
}

/**
 * Update resource display with data from resource manager
 * @param {HTMLElement} resourcesSection - The resources section element
 * @param {Object} resourceManager - The resource manager instance
 */
function updateResourceDisplay(resourcesSection, resourceManager) {
  // Get resource usage from the resource manager
  const resourceUsage = resourceManager.getResourceUsage();
  const currentMode = resourceManager.getCurrentMode();
  
  // Get memory usage from browser API as fallback
  const memoryUsage = window.performance && window.performance.memory ? 
    window.performance.memory : null;
  
  let memoryInfo = resourceUsage.memory ? 
    `${resourceUsage.memory.toFixed(1)}%` : 
    'Not available';
    
  // Add detailed memory info if available from browser
  if (memoryUsage) {
    const usedHeap = Math.round(memoryUsage.usedJSHeapSize / (1024 * 1024));
    const totalHeap = Math.round(memoryUsage.totalJSHeapSize / (1024 * 1024));
    const heapLimit = Math.round(memoryUsage.jsHeapSizeLimit / (1024 * 1024));
    memoryInfo += ` (${usedHeap}MB / ${totalHeap}MB, Limit: ${heapLimit}MB)`;
  }
  
  // Determine status classes based on resource usage
  const cpuClass = getCpuStatusClass(resourceUsage.cpu);
  const memoryClass = getMemoryStatusClass(resourceUsage.memory);
  const temperatureClass = getTemperatureStatusClass(resourceUsage.temperature);
  
  resourcesSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Resource Usage</h3>
    
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div>CPU Usage:</div>
        <div class="${cpuClass}">${resourceUsage.cpu ? resourceUsage.cpu.toFixed(1) + '%' : 'N/A'}</div>
      </div>
      ${resourceUsage.cpu ? createProgressBar(resourceUsage.cpu, cpuClass) : ''}
    </div>
    
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div>Memory:</div>
        <div class="${memoryClass}">${memoryInfo}</div>
      </div>
      ${resourceUsage.memory ? createProgressBar(resourceUsage.memory, memoryClass) : ''}
    </div>
    
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div>Temperature:</div>
        <div class="${temperatureClass}">${resourceUsage.temperature ? resourceUsage.temperature.toFixed(1) + '°C' : 'N/A'}</div>
      </div>
      ${resourceUsage.temperature ? createProgressBar((resourceUsage.temperature / 100) * 100, temperatureClass) : ''}
    </div>
    
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div>Battery:</div>
        <div>${resourceUsage.batteryLevel ? resourceUsage.batteryLevel.toFixed(0) + '%' + (resourceUsage.isCharging ? ' (Charging)' : '') : 'N/A'}</div>
      </div>
      ${resourceUsage.batteryLevel ? createProgressBar(resourceUsage.batteryLevel, 'status-normal') : ''}
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
      <div>Resource Mode:</div>
      <div><strong>${currentMode || 'Unknown'}</strong></div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Network:</div>
      <div>${navigator.onLine ? 'Online' : 'Offline'}</div>
    </div>
    
    <div>
      <button id="alejo-resource-settings" style="margin-top: 8px; padding: 4px 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Configure Resource Thresholds
      </button>
    </div>
  `;
  
  // Add event listener for resource settings button
  const settingsButton = resourcesSection.querySelector('#alejo-resource-settings');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      showResourceSettingsModal();
    });
  }
}

/**
 * Update resource display with fallback data when resource manager is unavailable
 * @param {HTMLElement} resourcesSection - The resources section element
 */
function updateResourceDisplayFallback(resourcesSection) {
  // Get memory usage from browser API
  const memoryUsage = window.performance && window.performance.memory ? 
    window.performance.memory : null;
  
  let memoryInfo = 'Not available';
  if (memoryUsage) {
    const usedHeap = Math.round(memoryUsage.usedJSHeapSize / (1024 * 1024));
    const totalHeap = Math.round(memoryUsage.totalJSHeapSize / (1024 * 1024));
    const heapLimit = Math.round(memoryUsage.jsHeapSizeLimit / (1024 * 1024));
    memoryInfo = `${usedHeap}MB / ${totalHeap}MB (Limit: ${heapLimit}MB)`;
  }
  
  resourcesSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Resource Usage</h3>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Memory:</div>
      <div>${memoryInfo}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Network:</div>
      <div>${navigator.onLine ? 'Online' : 'Offline'}</div>
    </div>
    <div style="padding: 8px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; margin-bottom: 8px;">
      <p style="margin: 0; font-size: 12px;">Resource manager not available. Using limited resource information.</p>
    </div>
    <div>
      <button id="alejo-resource-settings" style="margin-top: 8px; padding: 4px 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Configure Resource Thresholds
      </button>
    </div>
  `;
  
  // Add event listener for resource settings button
  const settingsButton = resourcesSection.querySelector('#alejo-resource-settings');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      showResourceSettingsModal();
    });
  }
}

/**
 * Create a visual progress bar
 * @param {number} percentage - Percentage value (0-100)
 * @param {string} statusClass - CSS class for status color
 * @returns {string} - HTML for progress bar
 */
function createProgressBar(percentage, statusClass) {
  // Ensure percentage is within bounds
  const value = Math.max(0, Math.min(100, percentage));
  
  return `
    <div style="width: 100%; height: 8px; background-color: #e9ecef; border-radius: 4px; overflow: hidden;" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
      <div class="${statusClass}-bg" style="width: ${value}%; height: 100%; transition: width 0.3s ease;"></div>
    </div>
  `;
}

/**
 * Get CSS class for CPU usage status
 * @param {number} cpuUsage - CPU usage percentage
 * @returns {string} - CSS status class
 */
function getCpuStatusClass(cpuUsage) {
  if (!cpuUsage && cpuUsage !== 0) return '';
  if (cpuUsage >= 80) return 'status-error';
  if (cpuUsage >= 60) return 'status-warning';
  return 'status-normal';
}

/**
 * Get CSS class for memory usage status
 * @param {number} memoryUsage - Memory usage percentage
 * @returns {string} - CSS status class
 */
function getMemoryStatusClass(memoryUsage) {
  if (!memoryUsage && memoryUsage !== 0) return '';
  if (memoryUsage >= 85) return 'status-error';
  if (memoryUsage >= 70) return 'status-warning';
  return 'status-normal';
}

/**
 * Get CSS class for temperature status
 * @param {number} temperature - Temperature in Celsius
 * @returns {string} - CSS status class
 */
function getTemperatureStatusClass(temperature) {
  if (!temperature && temperature !== 0) return '';
  if (temperature >= 80) return 'status-error';
  if (temperature >= 70) return 'status-warning';
  return 'status-normal';
}

/**
 * Show resource settings modal
 */
function showResourceSettingsModal() {
  // Create modal if it doesn't exist
  let modal = document.getElementById('alejo-resource-settings-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'alejo-resource-settings-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'resource-settings-title');
    modal.setAttribute('aria-modal', 'true');
    
    // Add screen reader only class if it doesn't exist
    if (!document.getElementById('alejo-sr-styles')) {
      const srStyles = document.createElement('style');
      srStyles.id = 'alejo-sr-styles';
      srStyles.textContent = `
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        
        /* High contrast mode support */
        @media (forced-colors: active) {
          .status-normal { color: CanvasText; }
          .status-warning { color: CanvasText; }
          .status-error { color: CanvasText; }
          .status-normal-bg { background-color: Canvas; border: 1px solid CanvasText; }
          .status-warning-bg { background-color: Canvas; border: 1px solid CanvasText; }
          .status-error-bg { background-color: Canvas; border: 1px solid CanvasText; }
        }
      `;
      document.head.appendChild(srStyles);
    }
    
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;
    
    // Add keyboard trap for modal
    modal.addEventListener('keydown', function(e) {
      // Close on escape key
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        return;
      }
      
      // Trap focus inside modal
      if (e.key === 'Tab') {
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    });
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      width: 400px;
      max-width: 90%;
    `;
    
    modalContent.innerHTML = `
      <h2 id="resource-settings-title" style="margin-top: 0;">Resource Settings</h2>
      <p>Configure how ALEJO manages system resources.</p>
      
      <div style="margin-bottom: 16px;">
        <label for="resource-mode" style="display: block; margin-bottom: 4px;">Resource Mode</label>
        <select id="resource-mode" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" aria-describedby="resource-mode-desc">
          <option value="auto">Automatic (Default)</option>
          <option value="full">Full Performance</option>
          <option value="balanced">Balanced</option>
          <option value="conservative">Conservative</option>
          <option value="minimal">Minimal (Accessibility Only)</option>
        </select>
        <div id="resource-mode-desc" class="sr-only">Select how ALEJO should balance performance and resource usage</div>
        <div style="margin-top: 4px; font-size: 11px; color: #666;">
          <span id="mode-description">Automatic: ALEJO will adjust resource usage based on system conditions</span>
        </div>
      </div>
      
      <section id="threshold-section">
        <h3 style="margin: 16px 0 8px 0; font-size: 14px;">Automatic Mode Thresholds</h3>
        <p style="margin-top: 0; font-size: 12px;">Configure when ALEJO should adapt to different resource modes.</p>
        
        <div style="margin-bottom: 16px;">
          <label for="memory-threshold" style="display: block; margin-bottom: 4px;">Memory Usage Threshold (%)</label>
          <input type="range" id="memory-threshold" min="50" max="90" value="75" style="width: 100%;">
          <div style="display: flex; justify-content: space-between;">
            <span>50%</span>
            <span id="memory-threshold-value">75%</span>
            <span>90%</span>
          </div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label for="cpu-threshold" style="display: block; margin-bottom: 4px;">CPU Usage Threshold (%)</label>
          <input type="range" id="cpu-threshold" min="50" max="90" value="70" style="width: 100%;">
          <div style="display: flex; justify-content: space-between;">
            <span>50%</span>
            <span id="cpu-threshold-value">70%</span>
            <span>90%</span>
          </div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label for="battery-threshold" style="display: block; margin-bottom: 4px;">Battery Threshold (%)</label>
          <input type="range" id="battery-threshold" min="10" max="50" value="20" style="width: 100%;" aria-describedby="battery-threshold-desc">
          <div style="display: flex; justify-content: space-between;">
            <span>10%</span>
            <span id="battery-threshold-value">20%</span>
            <span>50%</span>
          </div>
          <div id="battery-threshold-desc" class="sr-only">When battery falls below this level, ALEJO will switch to conservative mode</div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label for="temperature-threshold" style="display: block; margin-bottom: 4px;">Temperature Threshold (°C)</label>
          <input type="range" id="temperature-threshold" min="60" max="90" value="75" style="width: 100%;" aria-describedby="temperature-threshold-desc">
          <div style="display: flex; justify-content: space-between;">
            <span>60°C</span>
            <span id="temperature-threshold-value">75°C</span>
            <span>90°C</span>
          </div>
          <div id="temperature-threshold-desc" class="sr-only">When system temperature exceeds this level, ALEJO will reduce resource usage</div>
        </div>
      </section>
      
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
        <button id="resource-settings-cancel" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
        <button id="resource-settings-save" style="padding: 8px 16px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Save
        </button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Add event listeners for mode selection
    const modeSelect = modal.querySelector('#resource-mode');
    const modeDescription = modal.querySelector('#mode-description');
    
    // Mode descriptions
    const modeDescriptions = {
      'auto': 'Automatic: ALEJO will adjust resource usage based on system conditions',
      'full': 'Full Performance: Maximum capabilities with highest resource usage',
      'balanced': 'Balanced: Good performance while managing resource consumption',
      'conservative': 'Conservative: Reduced features to minimize resource usage',
      'minimal': 'Minimal: Only essential and accessibility features enabled'
    };
    
    modeSelect.addEventListener('change', () => {
      const selectedMode = modeSelect.value;
      modeDescription.textContent = modeDescriptions[selectedMode] || modeDescriptions['auto'];
      announceChange(`Resource mode set to ${selectedMode}`);
      
      // Show/hide threshold settings based on mode
      const thresholdSection = modal.querySelector('#threshold-section');
      if (selectedMode === 'auto') {
        thresholdSection.style.display = 'block';
      } else {
        thresholdSection.style.display = 'none';
      }
    });
    
    // Add event listeners for sliders
    const memorySlider = modal.querySelector('#memory-threshold');
    const memoryValue = modal.querySelector('#memory-threshold-value');
    memorySlider.addEventListener('input', () => {
      memoryValue.textContent = `${memorySlider.value}%`;
      announceChange(`Memory threshold set to ${memorySlider.value} percent`);
    });
    
    const cpuSlider = modal.querySelector('#cpu-threshold');
    const cpuValue = modal.querySelector('#cpu-threshold-value');
    cpuSlider.addEventListener('input', () => {
      cpuValue.textContent = `${cpuSlider.value}%`;
      announceChange(`CPU threshold set to ${cpuSlider.value} percent`);
    });
    
    const batterySlider = modal.querySelector('#battery-threshold');
    const batteryValue = modal.querySelector('#battery-threshold-value');
    batterySlider.addEventListener('input', () => {
      batteryValue.textContent = `${batterySlider.value}%`;
      announceChange(`Battery threshold set to ${batterySlider.value} percent`);
    });
    
    const temperatureSlider = modal.querySelector('#temperature-threshold');
    const temperatureValue = modal.querySelector('#temperature-threshold-value');
    temperatureSlider.addEventListener('input', () => {
      temperatureValue.textContent = `${temperatureSlider.value}°C`;
      announceChange(`Temperature threshold set to ${temperatureSlider.value} degrees`);
    });
    
    // Function to announce changes for screen readers
    function announceChange(message) {
      const announcer = document.getElementById('alejo-sr-announcer') || (() => {
        const el = document.createElement('div');
        el.id = 'alejo-sr-announcer';
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        document.body.appendChild(el);
        return el;
      })();
      announcer.textContent = message;
    }
    
    modal.querySelector('#resource-settings-cancel').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.querySelector('#resource-settings-save').addEventListener('click', () => {
      const settings = {
        resourceMode: modeSelect.value,
        memoryThreshold: parseInt(memorySlider.value, 10),
        cpuThreshold: parseInt(cpuSlider.value, 10),
        batteryThreshold: parseInt(batterySlider.value, 10),
        temperatureThreshold: parseInt(temperatureSlider.value, 10)
      };
      
      try {
        localStorage.setItem('alejo_resource_thresholds', JSON.stringify(settings));
        
        // Dispatch event for resource manager to pick up
        const event = new CustomEvent('alejo:resource:thresholds:updated', {
          detail: settings
        });
        document.dispatchEvent(event);
        
        // Announce success to screen readers
        announceChange('Resource settings saved successfully');
        
        document.body.removeChild(modal);
      } catch (e) {
        console.error('Failed to save resource thresholds:', e);
        announceChange('Failed to save resource settings');
      }
    });
  } else {
    // Show existing modal
    modal.style.display = 'flex';
  }
  
  // Load saved settings
  try {
    const savedSettings = JSON.parse(localStorage.getItem('alejo_resource_thresholds'));
    if (savedSettings) {
      // Load resource mode if available
      if (savedSettings.resourceMode) {
        modeSelect.value = savedSettings.resourceMode;
        modeDescription.textContent = modeDescriptions[savedSettings.resourceMode] || modeDescriptions['auto'];
        
        // Show/hide threshold section based on mode
        const thresholdSection = modal.querySelector('#threshold-section');
        if (savedSettings.resourceMode === 'auto') {
          thresholdSection.style.display = 'block';
        } else {
          thresholdSection.style.display = 'none';
        }
      }
      
      const memorySlider = modal.querySelector('#memory-threshold');
      const memoryValue = modal.querySelector('#memory-threshold-value');
      memorySlider.value = savedSettings.memoryThreshold;
      memoryValue.textContent = `${savedSettings.memoryThreshold}%`;
      
      const cpuSlider = modal.querySelector('#cpu-threshold');
      const cpuValue = modal.querySelector('#cpu-threshold-value');
      cpuSlider.value = savedSettings.cpuThreshold;
      cpuValue.textContent = `${savedSettings.cpuThreshold}%`;
      
      const batterySlider = modal.querySelector('#battery-threshold');
      const batteryValue = modal.querySelector('#battery-threshold-value');
      batterySlider.value = savedSettings.batteryThreshold;
      batteryValue.textContent = `${savedSettings.batteryThreshold}%`;
      
      // Load temperature threshold if available
      if (savedSettings.temperatureThreshold) {
        const temperatureSlider = modal.querySelector('#temperature-threshold');
        const temperatureValue = modal.querySelector('#temperature-threshold-value');
        temperatureSlider.value = savedSettings.temperatureThreshold;
        temperatureValue.textContent = `${savedSettings.temperatureThreshold}°C`;
      }
    }
  } catch (e) {
    console.warn('Failed to load resource thresholds:', e);
  }
  
  // Focus first interactive element for accessibility
  setTimeout(() => {
    const firstInput = modal.querySelector('input');
    if (firstInput) {
      firstInput.focus();
    }
  }, 100);
}

/**
 * Update the errors section
 */
function updateErrorsSection() {
  const errorsSection = dashboardElement.querySelector('#alejo-dashboard-errors');
  if (!errorsSection) return;
  
  const errorLog = getErrorLog(5); // Get the 5 most recent errors
  
  errorsSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Recent Errors</h3>
    <div style="max-height: 200px; overflow-y: auto;">
      ${errorLog.length === 0 ? 
        '<div style="text-align: center; padding: 8px; color: #2e7d32;">No errors reported</div>' : 
        errorLog.map(error => `
          <div style="margin-bottom: 8px; padding: 8px; border-left: 3px solid ${getSeverityColor(error.severity)}; background: #f5f5f5;">
            <div style="font-weight: 500; margin-bottom: 4px;">${error.source}</div>
            <div style="font-size: 12px;">${error.message}</div>
            <div style="font-size: 10px; color: #666; margin-top: 4px;">${new Date(error.timestamp).toLocaleString()}</div>
          </div>
        `).join('')
      }
    </div>
    ${errorLog.length > 0 ? 
      `<div style="text-align: right; margin-top: 8px;">
        <button id="alejo-view-all-errors" style="padding: 4px 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px;">
          View All Errors
        </button>
      </div>` : ''
    }
  `;
  
  // Add event listener for view all errors button
  const viewAllButton = errorsSection.querySelector('#alejo-view-all-errors');
  if (viewAllButton) {
    viewAllButton.addEventListener('click', () => {
      showErrorLogModal();
    });
  }
}

/**
 * Get color for error severity
 */
function getSeverityColor(severity) {
  switch (severity) {
    case 'critical': return '#d32f2f';
    case 'high': return '#f57c00';
    case 'medium': return '#fbc02d';
    case 'low': return '#7cb342';
    case 'info': return '#1976d2';
    default: return '#757575';
  }
}

/**
 * Show error log modal
 */
function showErrorLogModal() {
  const errorLog = getErrorLog(50); // Get up to 50 errors
  
  // Create modal
  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'error-log-title');
  modal.setAttribute('aria-modal', 'true');
  
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    width: 600px;
    max-width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  modalContent.innerHTML = `
    <h2 id="error-log-title" style="margin-top: 0;">Error Log</h2>
    <div style="margin-bottom: 16px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Time</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Source</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Severity</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Message</th>
          </tr>
        </thead>
        <tbody>
          ${errorLog.length === 0 ? 
            '<tr><td colspan="4" style="text-align: center; padding: 16px;">No errors logged</td></tr>' : 
            errorLog.map(error => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(error.timestamp).toLocaleString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${error.source}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                  <span style="color: ${getSeverityColor(error.severity)};">${error.severity}</span>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${error.message}</td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <button id="error-log-clear" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Clear Log
      </button>
      <button id="error-log-close" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
        Close
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.querySelector('#error-log-close').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  modal.querySelector('#error-log-clear').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the error log?')) {
      try {
        localStorage.removeItem('alejo_error_log');
        document.body.removeChild(modal);
        updateDashboard();
      } catch (e) {
        console.warn('Failed to clear error log:', e);
      }
    }
  });
}

/**
 * Create a floating button to toggle the dashboard
 * 
 * @returns {HTMLElement} - The toggle button element
 */
export function createDashboardToggle() {
  let toggleButton = document.getElementById('alejo-dashboard-toggle');
  
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.id = 'alejo-dashboard-toggle';
    toggleButton.setAttribute('aria-label', 'Toggle system monitoring dashboard');
    toggleButton.setAttribute('title', 'System Monitor');
    
    toggleButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #1976d2;
      color: white;
      border: none;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    `;
    
    toggleButton.innerHTML = '📊';
    
    toggleButton.addEventListener('click', () => {
      toggleDashboard();
    });
    
    document.body.appendChild(toggleButton);
  }
  
  return toggleButton;
}

// Export dashboard API
/**
 * Open the monitoring dashboard
 * Alias for showDashboard for test compatibility
 */
export function openMonitoringDashboard() {
  showDashboard();
}

/**
 * Close the monitoring dashboard
 * Alias for hideDashboard for test compatibility
 */
export function closeMonitoringDashboard() {
  hideDashboard();
}

/**
 * Toggle high contrast mode for accessibility
 */
export function toggleHighContrastMode() {
  highContrastMode = !highContrastMode;
  
  if (!dashboardElement) return;
  
  if (highContrastMode) {
    dashboardElement.classList.add('high-contrast');
    
    // Apply high contrast styles
    const styleElement = document.createElement('style');
    styleElement.id = 'alejo-high-contrast-styles';
    styleElement.textContent = `
      .alejo-dashboard.high-contrast {
        background: #000 !important;
        color: #fff !important;
        border-color: #fff !important;
      }
      
      .alejo-dashboard.high-contrast .alejo-dashboard-header {
        border-color: #fff !important;
      }
      
      .alejo-dashboard.high-contrast button {
        background: #000 !important;
        color: #fff !important;
        border: 1px solid #fff !important;
      }
      
      .alejo-dashboard.high-contrast .status-normal { color: #4cff4c !important; }
      .alejo-dashboard.high-contrast .status-warning { color: #ffff00 !important; }
      .alejo-dashboard.high-contrast .status-error { color: #ff6666 !important; }
      
      .alejo-dashboard.high-contrast .status-normal-bg { background-color: #006600 !important; }
      .alejo-dashboard.high-contrast .status-warning-bg { background-color: #666600 !important; }
      .alejo-dashboard.high-contrast .status-error-bg { background-color: #660000 !important; }
      
      .alejo-dashboard.high-contrast .component-row {
        border: 1px solid #fff !important;
      }
    `;
    
    document.head.appendChild(styleElement);
  } else {
    dashboardElement.classList.remove('high-contrast');
    
    // Remove high contrast styles
    const styleElement = document.getElementById('alejo-high-contrast-styles');
    if (styleElement) {
      document.head.removeChild(styleElement);
    }
  }
  
  // Announce change to screen readers
  const message = highContrastMode ? 
    'High contrast mode enabled' : 
    'High contrast mode disabled';
  
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.style.position = 'absolute';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 3000);
  
  return highContrastMode;
}

/**
 * Get the current state of the dashboard
 * 
 * @returns {Object} - Dashboard state
 */
export function getDashboardState() {
  return {
    isVisible,
    highContrastMode,
    sections,
    updateIntervalMs: updateInterval ? updateInterval._idleTimeout : null
  };
}

/**
 * Get accessibility status of the system
 * 
 * @returns {Object} - Accessibility status information
 */
export function getAccessibilityStatus() {
  const initStatus = getInitializationStatus();
  
  // Calculate accessibility components status
  const accessibilityComponents = initStatus.componentStatus ? 
    Object.values(initStatus.componentStatus).filter(comp => comp.isAccessibility) : 
    [];
  
  const totalAccessibilityComponents = accessibilityComponents.length;
  
  const initializedAccessibilityComponents = accessibilityComponents.filter(comp => 
    comp.status === 'initialized' || comp.status === 'fallback'
  ).length;
  
  const failedAccessibilityComponents = accessibilityComponents.filter(comp => 
    comp.status === 'failed'
  ).length;
  
  // Get components using accessibility-preserving fallbacks
  const fallbackStats = getFallbackStatistics();
  const preservedComponents = fallbackStats.componentsUsingFallbacks.filter(comp => 
    fallbackStats.fallbackMetadata[comp] && 
    fallbackStats.fallbackMetadata[comp].preservesAccessibility
  );
  
  return {
    totalAccessibilityComponents,
    initializedAccessibilityComponents,
    failedAccessibilityComponents,
    preservedComponents,
    highContrastModeEnabled: highContrastMode
  };
}

export default {
  init: initDashboard,
  show: showDashboard,
  hide: hideDashboard,
  toggle: toggleDashboard,
  update: updateDashboard,
  createToggle: createDashboardToggle,
  openMonitoringDashboard,
  closeMonitoringDashboard,
  getDashboardState,
  toggleHighContrastMode,
  getAccessibilityStatus
};
