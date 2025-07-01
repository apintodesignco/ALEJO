/**
 * Control Panel Component
 * 
 * Renders the main control panel interface for ALEJO.
 * This is loaded as part of the UI module when needed.
 */

import { publish, subscribe } from '../../core/events.js';

// Control panel state
let controlPanelState = {
  activeSection: 'main',
  isExpanded: false
};

/**
 * Render the control panel component
 */
export async function renderControlPanel() {
  console.log('Rendering control panel component');
  
  const controlPanelElement = document.getElementById('control-panel');
  if (!controlPanelElement) return;
  
  // Render the control panel structure
  controlPanelElement.innerHTML = `
    <div class="control-panel-header">
      <h2>Control Panel</h2>
      <button id="expand-panel" class="icon-button" aria-label="Expand panel">
        <span class="icon">▼</span>
      </button>
    </div>
    <nav class="control-panel-nav">
      <ul>
        <li><button id="nav-main" class="nav-button active" data-section="main">Main</button></li>
        <li><button id="nav-settings" class="nav-button" data-section="settings">Settings</button></li>
        <li><button id="nav-gesture" class="nav-button" data-section="gesture">Gesture</button></li>
        <li><button id="nav-help" class="nav-button" data-section="help">Help</button></li>
      </ul>
    </nav>
    <div class="control-panel-content">
      <section id="section-main" class="panel-section active">
        <h3>ALEJO Controls</h3>
        <div class="control-group">
          <button id="start-alejo" class="primary-button">Start</button>
          <button id="stop-alejo" class="secondary-button">Stop</button>
        </div>
        <div class="status-display" id="main-status">Ready</div>
      </section>
      
      <section id="section-settings" class="panel-section">
        <h3>Settings</h3>
        <form id="settings-form">
          <div class="form-group">
            <label for="theme-select">Theme</label>
            <select id="theme-select">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">System Default</option>
            </select>
          </div>
          <div class="form-group">
            <label for="performance-select">Performance Mode</label>
            <select id="performance-select">
              <option value="high">High Quality</option>
              <option value="balanced">Balanced</option>
              <option value="low">Power Saver</option>
            </select>
          </div>
          <div class="form-group checkbox">
            <input type="checkbox" id="enable-animations" checked>
            <label for="enable-animations">Enable Animations</label>
          </div>
          <div class="form-group checkbox">
            <input type="checkbox" id="enable-notifications" checked>
            <label for="enable-notifications">Enable Notifications</label>
          </div>
          <button type="submit" class="primary-button">Save Settings</button>
        </form>
      </section>
      
      <section id="section-gesture" class="panel-section">
        <h3>Gesture System</h3>
        <div class="control-group">
          <button id="enable-gesture" class="primary-button">Enable Gestures</button>
          <button id="calibrate-gesture" class="secondary-button">Calibrate</button>
        </div>
        <div class="gesture-status" id="gesture-status">
          <span class="status-indicator offline"></span>
          <span>Gesture system is not active</span>
        </div>
      </section>
      
      <section id="section-help" class="panel-section">
        <h3>Help</h3>
        <ul class="help-links">
          <li><a href="#" id="docs-link">Documentation</a></li>
          <li><a href="#" id="tutorials-link">Tutorials</a></li>
          <li><a href="#" id="support-link">Support</a></li>
        </ul>
        <div class="version-info">
          <p>ALEJO Version: <span id="version-number">1.0.0</span></p>
        </div>
      </section>
    </div>
  `;
  
  // Set up control panel event handlers
  setupControlPanelEvents();
  
  return true;
}

/**
 * Set up event handlers for the control panel
 */
function setupControlPanelEvents() {
  // Toggle expand/collapse
  const expandButton = document.getElementById('expand-panel');
  if (expandButton) {
    expandButton.addEventListener('click', toggleControlPanelExpansion);
  }
  
  // Section navigation
  document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('click', (event) => {
      const section = event.target.getAttribute('data-section');
      if (section) {
        activateSection(section);
      }
    });
  });
  
  // Start/Stop buttons
  document.getElementById('start-alejo')?.addEventListener('click', () => {
    publish('alejo:start', { timestamp: Date.now() });
    updateMainStatus('ALEJO is starting...');
  });
  
  document.getElementById('stop-alejo')?.addEventListener('click', () => {
    publish('alejo:stop', { timestamp: Date.now() });
    updateMainStatus('ALEJO is stopping...');
  });
  
  // Settings form
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      saveSettings();
    });
    
    // Theme selection changes
    document.getElementById('theme-select')?.addEventListener('change', (event) => {
      applyTheme(event.target.value);
    });
  }
  
  // Gesture system buttons
  document.getElementById('enable-gesture')?.addEventListener('click', async () => {
    // When the user clicks to enable gestures, we'll dynamically load the gesture module
    try {
      updateGestureStatus('loading');
      
      // Dynamically import the gesture module when needed
      const { initializeGesture } = await import('../../gesture/index.js');
      const result = await initializeGesture();
      
      if (result.success) {
        updateGestureStatus('online');
      } else {
        updateGestureStatus('error', result.error);
      }
    } catch (error) {
      console.error('Failed to load gesture module:', error);
      updateGestureStatus('error', error.message);
    }
  });
  
  document.getElementById('calibrate-gesture')?.addEventListener('click', () => {
    publish('gesture:calibrate', { timestamp: Date.now() });
    updateGestureStatus('calibrating');
  });
  
  // Subscribe to status updates
  subscribe('alejo:status', (status) => {
    updateMainStatus(status.message || 'Status updated');
  });
  
  // Subscribe to gesture system status
  subscribe('gesture:status', (status) => {
    updateGestureStatus(status.state, status.message);
  });
}

/**
 * Toggle the expanded/collapsed state of the control panel
 */
function toggleControlPanelExpansion() {
  const controlPanel = document.getElementById('control-panel');
  const expandButton = document.getElementById('expand-panel');
  
  if (!controlPanel || !expandButton) return;
  
  controlPanelState.isExpanded = !controlPanelState.isExpanded;
  
  // Toggle classes
  controlPanel.classList.toggle('expanded', controlPanelState.isExpanded);
  
  // Update button icon and accessibility label
  if (controlPanelState.isExpanded) {
    expandButton.innerHTML = '<span class="icon">▲</span>';
    expandButton.setAttribute('aria-label', 'Collapse panel');
  } else {
    expandButton.innerHTML = '<span class="icon">▼</span>';
    expandButton.setAttribute('aria-label', 'Expand panel');
  }
  
  // Publish event
  publish('ui:panel-toggle', { expanded: controlPanelState.isExpanded });
}

/**
 * Activate a specific section in the control panel
 */
function activateSection(sectionId) {
  // Update state
  controlPanelState.activeSection = sectionId;
  
  // Update nav buttons
  document.querySelectorAll('.nav-button').forEach(button => {
    button.classList.toggle('active', button.getAttribute('data-section') === sectionId);
  });
  
  // Update section visibility
  document.querySelectorAll('.panel-section').forEach(section => {
    section.classList.toggle('active', section.id === `section-${sectionId}`);
  });
  
  // Publish event
  publish('ui:section-change', { section: sectionId });
}

/**
 * Update the main status display
 */
function updateMainStatus(message) {
  const statusElement = document.getElementById('main-status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

/**
 * Update the gesture system status
 */
function updateGestureStatus(state, message = '') {
  const statusElement = document.getElementById('gesture-status');
  if (!statusElement) return;
  
  const indicator = statusElement.querySelector('.status-indicator');
  if (indicator) {
    // Remove all state classes
    indicator.classList.remove('online', 'offline', 'error', 'loading', 'calibrating');
    // Add the current state class
    indicator.classList.add(state);
  }
  
  // Update the text
  let statusText = 'Gesture system is ';
  switch (state) {
    case 'online':
      statusText += 'active and running';
      break;
    case 'offline':
      statusText += 'not active';
      break;
    case 'error':
      statusText += `encountering an error: ${message || 'Unknown error'}`;
      break;
    case 'loading':
      statusText += 'initializing...';
      break;
    case 'calibrating':
      statusText += 'calibrating...';
      break;
    default:
      statusText += state;
  }
  
  const textNode = statusElement.querySelector('span:not(.status-indicator)');
  if (textNode) {
    textNode.textContent = statusText;
  }
}

/**
 * Save settings from the form
 */
function saveSettings() {
  const settings = {
    theme: document.getElementById('theme-select')?.value || 'light',
    performance: document.getElementById('performance-select')?.value || 'balanced',
    animations: document.getElementById('enable-animations')?.checked || false,
    notifications: document.getElementById('enable-notifications')?.checked || false
  };
  
  // Apply settings immediately
  applyTheme(settings.theme);
  
  // Save to local storage for persistence
  try {
    localStorage.setItem('alejo_user_settings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
  }
  
  // Publish event for other components
  publish('settings:updated', settings);
  
  // Show confirmation
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    const confirmationMessage = document.createElement('div');
    confirmationMessage.className = 'settings-saved';
    confirmationMessage.textContent = 'Settings saved';
    settingsForm.appendChild(confirmationMessage);
    
    // Remove confirmation after 2 seconds
    setTimeout(() => {
      confirmationMessage.remove();
    }, 2000);
  }
}

/**
 * Apply theme to the application
 */
function applyTheme(theme) {
  // Remove any existing theme classes
  document.body.classList.remove('theme-light', 'theme-dark');
  
  // Apply selected theme
  if (theme === 'auto') {
    // Detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.add('theme-light');
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      if (document.getElementById('theme-select')?.value === 'auto') {
        document.body.classList.toggle('theme-dark', event.matches);
        document.body.classList.toggle('theme-light', !event.matches);
      }
    });
  } else {
    // Apply the specified theme
    document.body.classList.add(`theme-${theme}`);
  }
}
