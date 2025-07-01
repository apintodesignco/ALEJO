/**
 * ALEJO UI Module
 * 
 * This module handles the user interface components of ALEJO.
 * It's loaded dynamically via code-splitting to reduce initial bundle size.
 */

import { publish, subscribe } from '../core/events.js';
import { renderControlPanel } from './components/control-panel.js';
import { renderVisualization } from './components/visualization.js';

// Keep track of UI state
let uiInitialized = false;

/**
 * Initialize and render the main UI components
 */
export async function renderUI() {
  console.log('Rendering ALEJO UI components...');
  
  if (uiInitialized) {
    console.log('UI already initialized, refreshing view');
    refreshUI();
    return;
  }
  
  try {
    const app = document.getElementById('app');
    if (!app) {
      throw new Error('App container not found');
    }
    
    // Clear loading message
    app.innerHTML = '';
    
    // Create main UI structure
    const uiContainer = document.createElement('div');
    uiContainer.className = 'alejo-ui-container';
    uiContainer.innerHTML = `
      <header class="alejo-header">
        <h1>A.L.E.J.O.</h1>
        <div id="status-indicator" class="status-indicator active"></div>
      </header>
      <main class="alejo-main">
        <div id="visualization-container" class="visualization-container"></div>
        <div id="control-panel" class="control-panel"></div>
      </main>
      <footer class="alejo-footer">
        <div id="status" class="status-message">Ready</div>
      </footer>
    `;
    
    app.appendChild(uiContainer);
    
    // Render individual components (these could be further code-split)
    await Promise.all([
      renderControlPanel(),
      renderVisualization()
    ]);
    
    // Set up UI event listeners
    setupUIEventListeners();
    
    // Mark as initialized
    uiInitialized = true;
    
    // Announce UI is ready
    publish('ui:ready', true);
    
  } catch (error) {
    console.error('Failed to render UI:', error);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error-container">
          <h2>UI Initialization Error</h2>
          <p>${error.message}</p>
          <button id="retry-button">Retry</button>
        </div>
      `;
      
      document.getElementById('retry-button')?.addEventListener('click', renderUI);
    }
  }
}

/**
 * Set up event listeners for UI interactions
 */
function setupUIEventListeners() {
  // Listen for configuration changes
  subscribe('config:updated', refreshUI);
  
  // Listen for system status changes
  subscribe('system:status', updateStatus);
  
  // Listen for visibility changes
  subscribe('system:visibility', isVisible => {
    if (isVisible) {
      // Re-render or update when coming back to visible
      refreshUI();
    }
  });
  
  // Listen for window resize events
  subscribe('ui:resize', adjustLayoutForSize);
}

/**
 * Refresh the UI when data or settings change
 */
function refreshUI() {
  console.log('Refreshing UI components');
  
  // Update components as needed
  document.querySelectorAll('[data-refresh]').forEach(element => {
    const refreshType = element.getAttribute('data-refresh');
    
    // Add animation to indicate refresh
    element.classList.add('refreshing');
    
    // Remove animation after refresh completes
    setTimeout(() => {
      element.classList.remove('refreshing');
    }, 300);
  });
  
  // Publish refresh event for components to handle
  publish('ui:refreshed', { timestamp: Date.now() });
}

/**
 * Update the status message
 */
function updateStatus(status) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = status.message || status;
    
    // Update status indicator
    const indicator = document.getElementById('status-indicator');
    if (indicator) {
      indicator.className = 'status-indicator';
      indicator.classList.add(status.level || 'info');
    }
  }
}

/**
 * Adjust layout based on screen size for responsive design
 */
function adjustLayoutForSize(dimensions) {
  const { width } = dimensions;
  
  // Apply different layouts based on screen size
  document.body.classList.toggle('compact-layout', width < 768);
  document.body.classList.toggle('medium-layout', width >= 768 && width < 1200);
  document.body.classList.toggle('large-layout', width >= 1200);
  
  // Let components know about the size change
  publish('ui:layout-changed', {
    size: width < 768 ? 'small' : width < 1200 ? 'medium' : 'large'
  });
}
