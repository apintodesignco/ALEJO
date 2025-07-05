/**
 * ALEJO Unreal Engine UI Bridge
 * 
 * This module serves as a bridge between ALEJO's web UI components and the
 * Unreal Engine rendering and avatar systems, enabling seamless user interaction
 * between the web interface and the 3D environment.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// Default configuration
const DEFAULT_CONFIG = {
  // UI element selectors
  containerSelector: '#alejo-unreal-container',
  overlaySelector: '#alejo-ui-overlay',
  controlsSelector: '#alejo-controls',
  
  // UI options
  showControls: true,
  showDebugInfo: false,
  allowFullscreen: true,
  
  // Interaction options
  enablePointerLock: true,
  captureKeyboardInput: true,
  
  // Accessibility options
  accessibilityFeatures: {
    highContrast: false,
    simplifiedAnimations: false,
    reducedMotion: false,
    descriptiveAudio: false
  }
};

/**
 * Initializes the UI bridge between ALEJO web UI and Unreal Engine
 * @param {Object} renderingSystem - The initialized Unreal Engine rendering system
 * @param {Object} avatarSystem - The initialized Unreal Engine avatar system
 * @param {Object} config - UI bridge configuration
 * @returns {Object} - Initialized UI bridge
 */
export async function initializeUIBridge(renderingSystem, avatarSystem, config = {}) {
  console.log('Initializing ALEJO Unreal Engine UI bridge');
  
  // Merge with default configuration
  const bridgeConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  try {
    // Get container element
    const container = document.querySelector(bridgeConfig.containerSelector);
    if (!container) {
      throw new Error(`UI container not found: ${bridgeConfig.containerSelector}`);
    }
    
    // Create UI components
    const uiComponents = createUIComponents(container, bridgeConfig);
    
    // Set up event listeners
    setupEventListeners(uiComponents, renderingSystem, avatarSystem, bridgeConfig);
    
    // Create UI bridge object
    const bridge = {
      // UI components
      ui: uiComponents,
      
      // Configuration
      config: bridgeConfig,
      
      /**
       * Updates the UI bridge configuration
       * @param {Object} newConfig - New configuration options
       */
      updateConfig(newConfig) {
        Object.assign(bridgeConfig, newConfig);
        updateUIFromConfig(uiComponents, bridgeConfig);
      },
      
      /**
       * Shows a notification in the UI
       * @param {string} message - Notification message
       * @param {string} type - Notification type ('info', 'warning', 'error', 'success')
       * @param {number} duration - Duration in milliseconds (0 for persistent)
       */
      showNotification(message, type = 'info', duration = 3000) {
        const notification = createNotification(message, type);
        uiComponents.notifications.appendChild(notification);
        
        // Auto-remove notification after duration
        if (duration > 0) {
          setTimeout(() => {
            if (notification.parentNode === uiComponents.notifications) {
              notification.classList.add('fade-out');
              setTimeout(() => {
                if (notification.parentNode === uiComponents.notifications) {
                  uiComponents.notifications.removeChild(notification);
                }
              }, 300);
            }
          }, duration);
        }
        
        return notification;
      },
      
      /**
       * Shows a loading indicator
       * @param {string} message - Loading message
       * @returns {Object} - Loading indicator control
       */
      showLoading(message = 'Loading...') {
        // Create loading indicator
        const loadingElement = document.createElement('div');
        loadingElement.className = 'alejo-loading';
        loadingElement.innerHTML = `
          <div class="alejo-loading-spinner"></div>
          <div class="alejo-loading-message">${message}</div>
        `;
        
        // Add to overlay
        uiComponents.overlay.appendChild(loadingElement);
        
        // Return control object
        return {
          /**
           * Updates the loading message
           * @param {string} newMessage - New loading message
           */
          updateMessage(newMessage) {
            const messageElement = loadingElement.querySelector('.alejo-loading-message');
            if (messageElement) {
              messageElement.textContent = newMessage;
            }
          },
          
          /**
           * Completes the loading and removes the indicator
           * @param {string} completionMessage - Optional completion message to show briefly
           * @param {number} completionDuration - Duration to show completion message
           */
          complete(completionMessage, completionDuration = 1000) {
            if (completionMessage) {
              const messageElement = loadingElement.querySelector('.alejo-loading-message');
              if (messageElement) {
                messageElement.textContent = completionMessage;
              }
              
              loadingElement.classList.add('alejo-loading-complete');
              
              setTimeout(() => {
                if (loadingElement.parentNode === uiComponents.overlay) {
                  loadingElement.classList.add('fade-out');
                  setTimeout(() => {
                    if (loadingElement.parentNode === uiComponents.overlay) {
                      uiComponents.overlay.removeChild(loadingElement);
                    }
                  }, 300);
                }
              }, completionDuration);
            } else {
              loadingElement.classList.add('fade-out');
              setTimeout(() => {
                if (loadingElement.parentNode === uiComponents.overlay) {
                  uiComponents.overlay.removeChild(loadingElement);
                }
              }, 300);
            }
          }
        };
      },
      
      /**
       * Shows debug information in the UI
       * @param {boolean} show - Whether to show or hide debug info
       */
      showDebugInfo(show = true) {
        bridgeConfig.showDebugInfo = show;
        uiComponents.debugInfo.style.display = show ? 'block' : 'none';
        
        // Update debug info if showing
        if (show) {
          updateDebugInfo(uiComponents.debugInfo, renderingSystem, avatarSystem);
        }
      },
      
      /**
       * Toggles fullscreen mode
       * @returns {Promise<boolean>} - Whether fullscreen is active
       */
      async toggleFullscreen() {
        if (!bridgeConfig.allowFullscreen) {
          return false;
        }
        
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return false;
        } else {
          await container.requestFullscreen();
          return true;
        }
      },
      
      /**
       * Shuts down the UI bridge
       */
      shutdown() {
        // Remove event listeners
        removeEventListeners();
        
        // Clear UI elements
        while (uiComponents.overlay.firstChild) {
          uiComponents.overlay.removeChild(uiComponents.overlay.firstChild);
        }
        
        // Reset container
        container.classList.remove('alejo-unreal-active');
      }
    };
    
    // Publish initialization success event
    publish('unreal:ui-bridge:initialized', { bridge });
    
    return bridge;
  } catch (error) {
    console.error('Failed to initialize Unreal Engine UI bridge:', error);
    publish('unreal:ui-bridge:error', { error });
    throw error;
  }
}

/**
 * Creates UI components for the bridge
 * @param {HTMLElement} container - Container element
 * @param {Object} config - UI bridge configuration
 * @returns {Object} - Created UI components
 */
function createUIComponents(container, config) {
  // Add active class to container
  container.classList.add('alejo-unreal-active');
  
  // Create overlay
  let overlay = document.querySelector(config.overlaySelector);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = config.overlaySelector.substring(1);
    overlay.className = 'alejo-ui-overlay';
    container.appendChild(overlay);
  }
  
  // Create notifications area
  const notifications = document.createElement('div');
  notifications.className = 'alejo-notifications';
  overlay.appendChild(notifications);
  
  // Create controls
  let controls = document.querySelector(config.controlsSelector);
  if (!controls) {
    controls = document.createElement('div');
    controls.id = config.controlsSelector.substring(1);
    controls.className = 'alejo-controls';
    
    // Add control buttons
    controls.innerHTML = `
      <button class="alejo-control-btn alejo-fullscreen-btn" title="Toggle Fullscreen">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        </svg>
      </button>
      <button class="alejo-control-btn alejo-settings-btn" title="Settings">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
      </button>
    `;
    
    overlay.appendChild(controls);
  }
  
  // Create debug info panel
  const debugInfo = document.createElement('div');
  debugInfo.className = 'alejo-debug-info';
  debugInfo.style.display = config.showDebugInfo ? 'block' : 'none';
  overlay.appendChild(debugInfo);
  
  // Create settings panel
  const settings = document.createElement('div');
  settings.className = 'alejo-settings-panel';
  settings.style.display = 'none';
  
  // Add settings content
  settings.innerHTML = `
    <div class="alejo-settings-header">
      <h3>ALEJO Settings</h3>
      <button class="alejo-settings-close">&times;</button>
    </div>
    <div class="alejo-settings-content">
      <div class="alejo-settings-section">
        <h4>Rendering</h4>
        <div class="alejo-settings-option">
          <label>
            <input type="checkbox" name="showDebugInfo"> 
            Show Debug Information
          </label>
        </div>
      </div>
      <div class="alejo-settings-section">
        <h4>Accessibility</h4>
        <div class="alejo-settings-option">
          <label>
            <input type="checkbox" name="highContrast"> 
            High Contrast Mode
          </label>
        </div>
        <div class="alejo-settings-option">
          <label>
            <input type="checkbox" name="simplifiedAnimations"> 
            Simplified Animations
          </label>
        </div>
        <div class="alejo-settings-option">
          <label>
            <input type="checkbox" name="reducedMotion"> 
            Reduced Motion
          </label>
        </div>
        <div class="alejo-settings-option">
          <label>
            <input type="checkbox" name="descriptiveAudio"> 
            Descriptive Audio
          </label>
        </div>
      </div>
    </div>
  `;
  
  overlay.appendChild(settings);
  
  // Update settings from config
  updateUIFromConfig({ settings }, config);
  
  return {
    container,
    overlay,
    notifications,
    controls,
    debugInfo,
    settings
  };
}

/**
 * Updates UI elements based on configuration
 * @param {Object} ui - UI components
 * @param {Object} config - UI bridge configuration
 */
function updateUIFromConfig(ui, config) {
  // Update controls visibility
  if (ui.controls) {
    ui.controls.style.display = config.showControls ? 'flex' : 'none';
  }
  
  // Update debug info visibility
  if (ui.debugInfo) {
    ui.debugInfo.style.display = config.showDebugInfo ? 'block' : 'none';
  }
  
  // Update settings checkboxes
  if (ui.settings) {
    // Debug info checkbox
    const debugInfoCheckbox = ui.settings.querySelector('input[name="showDebugInfo"]');
    if (debugInfoCheckbox) {
      debugInfoCheckbox.checked = config.showDebugInfo;
    }
    
    // Accessibility checkboxes
    for (const [key, value] of Object.entries(config.accessibilityFeatures)) {
      const checkbox = ui.settings.querySelector(`input[name="${key}"]`);
      if (checkbox) {
        checkbox.checked = value;
      }
    }
  }
}

/**
 * Creates a notification element
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('info', 'warning', 'error', 'success')
 * @returns {HTMLElement} - Notification element
 */
function createNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `alejo-notification alejo-notification-${type}`;
  
  // Add icon based on type
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
      break;
    case 'warning':
      icon = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
      break;
    case 'error':
      icon = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
      break;
    default: // info
      icon = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
  }
  
  notification.innerHTML = `
    <div class="alejo-notification-icon">${icon}</div>
    <div class="alejo-notification-content">${message}</div>
    <button class="alejo-notification-close">&times;</button>
  `;
  
  // Add close button handler
  const closeButton = notification.querySelector('.alejo-notification-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    });
  }
  
  return notification;
}

/**
 * Updates debug information panel
 * @param {HTMLElement} debugElement - Debug info element
 * @param {Object} renderingSystem - Rendering system
 * @param {Object} avatarSystem - Avatar system
 */
function updateDebugInfo(debugElement, renderingSystem, avatarSystem) {
  // Get rendering info
  const renderingInfo = {
    type: renderingSystem.type,
    fps: renderingSystem.stats?.fps || 'N/A',
    resolution: renderingSystem.canvas ? 
      `${renderingSystem.canvas.width}x${renderingSystem.canvas.height}` : 'N/A'
  };
  
  // Get avatar info
  const activeAvatar = avatarSystem.getActiveAvatar();
  const avatarInfo = {
    type: avatarSystem.type,
    activeAvatar: activeAvatar ? activeAvatar.id : 'None',
    loadedAvatars: avatarSystem.getLoadedAvatars().length
  };
  
  // Update debug info content
  debugElement.innerHTML = `
    <h4>Debug Information</h4>
    <div class="alejo-debug-section">
      <h5>Rendering</h5>
      <ul>
        <li>Type: ${renderingInfo.type}</li>
        <li>FPS: ${renderingInfo.fps}</li>
        <li>Resolution: ${renderingInfo.resolution}</li>
      </ul>
    </div>
    <div class="alejo-debug-section">
      <h5>Avatar</h5>
      <ul>
        <li>Type: ${avatarInfo.type}</li>
        <li>Active Avatar: ${avatarInfo.activeAvatar}</li>
        <li>Loaded Avatars: ${avatarInfo.loadedAvatars}</li>
      </ul>
    </div>
  `;
}

// Event listener references for cleanup
const eventListeners = [];

/**
 * Sets up event listeners for UI components
 * @param {Object} ui - UI components
 * @param {Object} renderingSystem - Rendering system
 * @param {Object} avatarSystem - Avatar system
 * @param {Object} config - UI bridge configuration
 */
function setupEventListeners(ui, renderingSystem, avatarSystem, config) {
  // Fullscreen button
  const fullscreenBtn = ui.controls.querySelector('.alejo-fullscreen-btn');
  if (fullscreenBtn && config.allowFullscreen) {
    const fullscreenHandler = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        ui.container.requestFullscreen();
      }
    };
    
    fullscreenBtn.addEventListener('click', fullscreenHandler);
    eventListeners.push({ element: fullscreenBtn, type: 'click', handler: fullscreenHandler });
  }
  
  // Settings button
  const settingsBtn = ui.controls.querySelector('.alejo-settings-btn');
  if (settingsBtn) {
    const settingsHandler = () => {
      ui.settings.style.display = ui.settings.style.display === 'none' ? 'block' : 'none';
    };
    
    settingsBtn.addEventListener('click', settingsHandler);
    eventListeners.push({ element: settingsBtn, type: 'click', handler: settingsHandler });
  }
  
  // Settings close button
  const settingsCloseBtn = ui.settings.querySelector('.alejo-settings-close');
  if (settingsCloseBtn) {
    const closeHandler = () => {
      ui.settings.style.display = 'none';
    };
    
    settingsCloseBtn.addEventListener('click', closeHandler);
    eventListeners.push({ element: settingsCloseBtn, type: 'click', handler: closeHandler });
  }
  
  // Settings checkboxes
  const checkboxes = ui.settings.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    const changeHandler = () => {
      if (checkbox.name === 'showDebugInfo') {
        config.showDebugInfo = checkbox.checked;
        ui.debugInfo.style.display = checkbox.checked ? 'block' : 'none';
        
        // Update debug info if showing
        if (checkbox.checked) {
          updateDebugInfo(ui.debugInfo, renderingSystem, avatarSystem);
        }
      } else if (Object.keys(config.accessibilityFeatures).includes(checkbox.name)) {
        // Update accessibility feature
        config.accessibilityFeatures[checkbox.name] = checkbox.checked;
        
        // Publish accessibility settings update
        publish('accessibility:settings:update', {
          settings: config.accessibilityFeatures
        });
      }
    };
    
    checkbox.addEventListener('change', changeHandler);
    eventListeners.push({ element: checkbox, type: 'change', handler: changeHandler });
  });
  
  // Debug info update interval
  if (config.showDebugInfo) {
    const debugInterval = setInterval(() => {
      if (ui.debugInfo.style.display !== 'none') {
        updateDebugInfo(ui.debugInfo, renderingSystem, avatarSystem);
      }
    }, 1000);
    
    // Store interval for cleanup
    eventListeners.push({ interval: debugInterval });
  }
  
  // Keyboard input capture
  if (config.captureKeyboardInput) {
    const keyHandler = (event) => {
      // Only capture keyboard input when container is focused
      if (document.activeElement === ui.container || 
          ui.container.contains(document.activeElement)) {
        // Forward keyboard events to rendering system
        publish('unreal:input:keyboard', {
          type: event.type,
          key: event.key,
          code: event.code,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey
        });
        
        // Prevent default for captured keys
        // Allow F keys, ESC, and modifier keys to pass through
        if (!event.key.startsWith('F') && 
            event.key !== 'Escape' && 
            !event.altKey && 
            !event.ctrlKey && 
            !event.metaKey) {
          event.preventDefault();
        }
      }
    };
    
    document.addEventListener('keydown', keyHandler);
    document.addEventListener('keyup', keyHandler);
    
    eventListeners.push({ element: document, type: 'keydown', handler: keyHandler });
    eventListeners.push({ element: document, type: 'keyup', handler: keyHandler });
  }
  
  // Subscribe to rendering system events
  subscribe('unreal:rendering:stats', (event) => {
    if (config.showDebugInfo && ui.debugInfo.style.display !== 'none') {
      updateDebugInfo(ui.debugInfo, renderingSystem, avatarSystem);
    }
  });
  
  // Subscribe to avatar system events
  subscribe('unreal:avatar:activated', (event) => {
    if (config.showDebugInfo && ui.debugInfo.style.display !== 'none') {
      updateDebugInfo(ui.debugInfo, renderingSystem, avatarSystem);
    }
  });
}

/**
 * Removes all event listeners
 */
function removeEventListeners() {
  eventListeners.forEach(listener => {
    if (listener.interval) {
      clearInterval(listener.interval);
    } else if (listener.element && listener.type && listener.handler) {
      listener.element.removeEventListener(listener.type, listener.handler);
    }
  });
  
  // Clear event listeners array
  eventListeners.length = 0;
}

export default {
  initializeUIBridge
};
