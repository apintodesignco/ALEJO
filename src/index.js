/**
 * ALEJO Frontend Entry Point
 * 
 * This file serves as the main entry point for the ALEJO frontend application.
 * It implements code splitting and lazy loading to optimize performance.
 */

// Import core styles
import './assets/css/main.css';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ALEJO Frontend Initializing...');
  
  // Show loading indicator
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '<div class="loading">Loading ALEJO...</div>';
  }
  
  try {
    // Dynamically import core module (smaller initial bundle)
    const { initializeCore } = await import('./core/index.js');
    await initializeCore();
    
    // Load UI components only when needed
    const startButton = document.getElementById('start-button');
    if (startButton) {
      startButton.addEventListener('click', async () => {
        // Dynamically import UI module when user interacts
        const { renderUI } = await import('./ui/index.js');
        renderUI();
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
          });
      });
    }
    
    // Initialize WebSocket connection for real-time updates
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
    };
    
    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      // Handle different message types
      if (message.type === 'status') {
        updateStatus(message.text);
      } else if (message.type === 'complete') {
        updateStatus('ALEJO is ready!');
        
        // Only load gesture system when startup is complete
        // This prevents loading heavy ML models until needed
        if (message.gesture_enabled) {
          try {
            const { initializeGesture } = await import('./gesture/index.js');
            initializeGesture();
          } catch (error) {
            console.error('Failed to load gesture system:', error);
          }
        }
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      updateStatus('Connection lost. Please refresh the page.');
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateStatus('Connection error. Please refresh the page.');
    };
    
  } catch (error) {
    console.error('Error initializing ALEJO frontend:', error);
    if (app) {
      app.innerHTML = '<div class="error">Failed to initialize ALEJO. Please refresh the page.</div>';
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
