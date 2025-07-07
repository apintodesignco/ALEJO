/**
 * ALEJO Frontend Entry Point
 * 
 * This file serves as the main entry point for the ALEJO frontend application.
 * It implements code splitting, lazy loading, robust error handling,
 * and system monitoring to optimize performance and reliability.
 */

// Import core styles
import './assets/css/main.css';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ALEJO Frontend Initializing...');
  
  // Show loading indicator
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading ALEJO...</div>
        <div id="initialization-status" class="initialization-status" aria-live="polite">Initializing core systems...</div>
      </div>
    `;
  }
  
  // Track initialization progress
  const statusElement = document.getElementById('initialization-status');
  const updateInitStatus = (message) => {
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.setAttribute('aria-label', message);
    }
  };
  
  try {
    // Dynamically import core module with enhanced error handling
    const { 
      initializeCore, 
      getMonitoringDashboard,
      getSystemStatus,
      logError,
      ErrorSeverity
    } = await import('./core/index.js');
    
    // Initialize core with monitoring dashboard enabled
    updateInitStatus('Initializing core systems...');
    const initResult = await initializeCore({
      showDashboard: false, // Don't show automatically, we'll add a toggle button
      enableFallbacks: true  // Enable fallback mechanisms for graceful degradation
    });
    
    if (!initResult.success) {
      throw new Error(`Core initialization failed: ${initResult.error?.message || 'Unknown error'}`);
    }
    
    updateInitStatus('Core systems initialized successfully');
    
    // Create dashboard toggle button
    const dashboard = getMonitoringDashboard();
    dashboard.createToggle({
      position: 'bottom-right',
      label: 'System Monitor',
      showOnError: true
    });
    
    // Load UI components only when needed
    const startButton = document.getElementById('start-button');
    if (startButton) {
      startButton.addEventListener('click', async () => {
        try {
          updateInitStatus('Loading UI components...');
          // Dynamically import UI module when user interacts
          const { renderUI } = await import('./ui/index.js');
          await renderUI();
          updateInitStatus('UI components loaded successfully');
        } catch (error) {
          logError('ui:initialization', error, ErrorSeverity.HIGH);
          updateInitStatus('Failed to load UI components. Using fallback interface.');
          // Show the monitoring dashboard on UI failure
          dashboard.show();
        }
      });
    }
    
    // Register service worker for PWA features
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch(err => {
            console.log('ServiceWorker registration failed: ', err);
            logError('pwa:service-worker', err, ErrorSeverity.MEDIUM);
          });
      });
    }
    
    // Initialize WebSocket connection for real-time updates with robust error handling
    updateInitStatus('Establishing real-time connection...');
    let wsReconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY = 2000; // 2 seconds
    
    function connectWebSocket() {
      try {
        const ws = new WebSocket(`ws://${window.location.host}/ws`);
        
        ws.onopen = () => {
          console.log('WebSocket connection established');
          wsReconnectAttempts = 0; // Reset reconnect counter on successful connection
          updateInitStatus('Real-time connection established');
        };
        
        ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle different message types
            if (message.type === 'status') {
              updateStatus(message.text);
            } else if (message.type === 'complete') {
              updateStatus('ALEJO is ready!');
              updateInitStatus('All systems operational');
              
              // Only load gesture system when startup is complete
              // This prevents loading heavy ML models until needed
              if (message.gesture_enabled) {
                try {
                  updateInitStatus('Initializing gesture recognition system...');
                  const { initializeGesture } = await import('./gesture/index.js');
                  await initializeGesture();
                  updateInitStatus('Gesture recognition system ready');
                } catch (error) {
                  logError('gesture:initialization', error, ErrorSeverity.MEDIUM);
                  updateInitStatus('Gesture system unavailable. Using fallback interaction methods.');
                }
              }
            } else if (message.type === 'error') {
              logError('websocket:message', new Error(message.text), ErrorSeverity.MEDIUM);
              updateStatus(`Error: ${message.text}`);
            }
          } catch (error) {
            logError('websocket:parse', error, ErrorSeverity.LOW);
          }
        };
        
        ws.onclose = (event) => {
          console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
          
          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            wsReconnectAttempts++;
            updateInitStatus(`Connection lost. Reconnecting (${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            setTimeout(connectWebSocket, RECONNECT_DELAY);
          } else if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            updateStatus('Connection lost. Please refresh the page.');
            updateInitStatus('Failed to establish stable connection after multiple attempts.');
            logError('websocket:connection', new Error('Max reconnection attempts reached'), ErrorSeverity.HIGH);
          }
        };
        
        ws.onerror = (error) => {
          logError('websocket:error', error, ErrorSeverity.MEDIUM);
          updateInitStatus('Connection error occurred');
        };
        
        return ws;
      } catch (error) {
        logError('websocket:initialization', error, ErrorSeverity.MEDIUM);
        updateInitStatus('Failed to establish real-time connection. Some features may be limited.');
        return null;
      }
    }
    
    // Establish initial WebSocket connection
    const ws = connectWebSocket();
    
    // Periodically check system status and update dashboard
    setInterval(() => {
      const status = getSystemStatus();
      if (status.components) {
        const failedComponents = Object.values(status.components).filter(c => c.status === 'failed');
        if (failedComponents.length > 0) {
          // Show dashboard automatically if essential components fail
          const hasEssentialFailures = failedComponents.some(c => c.isEssential);
          if (hasEssentialFailures) {
            dashboard.show();
          }
        }
      }
    }, 30000); // Check every 30 seconds
    
  } catch (error) {
    console.error('Error initializing ALEJO frontend:', error);
    logError('frontend:initialization', error, ErrorSeverity.CRITICAL);
    
    if (app) {
      app.innerHTML = `
        <div class="error">
          <h2>Failed to initialize ALEJO</h2>
          <p>We encountered a problem while starting the application:</p>
          <pre class="error-details">${error.message || 'Unknown error'}</pre>
          <p>Please try refreshing the page. If the problem persists, check the system monitor for details.</p>
          <button id="retry-button" class="retry-button">Retry</button>
          <button id="show-monitor" class="monitor-button">System Monitor</button>
        </div>
      `;
      
      // Add retry functionality
      const retryButton = document.getElementById('retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          window.location.reload();
        });
      }
      
      // Add monitor button functionality
      const monitorButton = document.getElementById('show-monitor');
      if (monitorButton) {
        monitorButton.addEventListener('click', async () => {
          try {
            const { getMonitoringDashboard } = await import('./core/index.js');
            const dashboard = getMonitoringDashboard();
            dashboard.show();
          } catch (e) {
            alert('Unable to load system monitor. Please refresh the page.');
          }
        });
      }
    }
  }
});

// Update status message in the UI
function updateStatus(message) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

// Prefetch critical chunks when user hovers over interactive elements
function prefetchOnHover(elementId, moduleToLoad) {
  const element = document.getElementById(elementId);
  if (element) {
    element.addEventListener('mouseover', () => {
      import(/* @vite-ignore */ moduleToLoad);
    }, { once: true }); // Only prefetch once
  }
}

// Prefetch gesture system when user hovers over the start button
prefetchOnHover('start-button', './gesture/index.js');
