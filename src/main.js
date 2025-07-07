/**
 * ALEJO Main Application Entry Point
 * 
 * This file serves as the main entry point for the ALEJO application,
 * orchestrating the initialization of all modules and features.
 * 
 * It implements a performance-optimized loading strategy with:
 * - Progressive loading of features
 * - Deferred initialization of non-critical components
 * - Integration of SEO features
 * - Service worker registration
 */

import { initializeCore } from './core/index.js';
import { initializeSEO } from './seo/index.js';
import { initializeAccessibility } from './personalization/accessibility/index.js';
import { initializePerformanceModule } from './performance/index.js';

// Main application state
const ALEJO = {
  version: '1.0.0',
  initialized: false,
  modules: {},
  config: {},
  debug: false
};

// Global access to ALEJO
window.ALEJO = ALEJO;

/**
 * Initialize the application
 * @param {Object} options - Initialization options
 */
async function initializeApplication(options = {}) {
  console.log(`Initializing ALEJO v${ALEJO.version}`);
  
  try {
    // Start performance measurement
    const perfStart = performance.now();
    
    // Set debug mode based on URL or options
    ALEJO.debug = options.debug || 
                  window.location.search.includes('debug=true') || 
                  localStorage.getItem('alejo_debug') === 'true';
    
    if (ALEJO.debug) {
      console.log('Debug mode enabled');
    }
    
    // Initialize core functionality first (high priority)
    console.log('Initializing core module...');
    ALEJO.modules.core = await initializeCore({
      debug: ALEJO.debug,
      ...options.core
    });
    
    // Initialize SEO features early for better indexing
    console.log('Initializing SEO features...');
    ALEJO.modules.seo = initializeSEO({
      siteName: 'ALEJO | Advanced Gesture Recognition System',
      ...options.seo
    });
    
    // Dynamically import UI module (medium priority)
    console.log('Loading UI module...');
    const uiModule = await import('./ui/index.js');
    ALEJO.modules.ui = await uiModule.initializeUI({
      rootElement: document.getElementById('app'),
      ...options.ui
    });
    
    // Initialize accessibility features (medium priority)
    console.log('Initializing accessibility features...');
    ALEJO.modules.accessibility = await initializeAccessibility({
      debug: ALEJO.debug,
      ...options.accessibility
    });
    
    // Initialize performance module (high priority for resource management)
    console.log('Initializing performance module...');
    ALEJO.modules.performance = await initializePerformanceModule({
      debug: ALEJO.debug,
      ...options.performance
    });
    
    // Register service worker for PWA features (low priority)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
    
    // Load the gesture module only when needed (deferred loading)
    // We'll set up the trigger to load it later
    
    // Measure and log initialization time
    const perfEnd = performance.now();
    console.log(`ALEJO initialized in ${(perfEnd - perfStart).toFixed(2)}ms`);
    
    // Mark application as initialized
    ALEJO.initialized = true;
    
    // Publish initialization complete event
    ALEJO.modules.core.events.publish('application:initialized', {
      timestamp: Date.now(),
      loadTime: perfEnd - perfStart,
      features: Object.keys(ALEJO.modules)
    });
    
    return ALEJO;
  } catch (error) {
    console.error('Failed to initialize ALEJO:', error);
    
    // Attempt graceful degradation
    const errorElement = document.createElement('div');
    errorElement.className = 'alejo-error';
    errorElement.innerHTML = `
      <h2>Initialization Error</h2>
      <p>Sorry, we encountered an error while loading ALEJO. Please try refreshing the page.</p>
      ${ALEJO.debug ? `<pre>${error.stack || error.message}</pre>` : ''}
    `;
    document.getElementById('app').appendChild(errorElement);
    
    throw error;
  }
}

/**
 * Load the gesture module on demand
 */
async function loadGestureModule(options = {}) {
  if (ALEJO.modules.gesture) {
    return ALEJO.modules.gesture;
  }
  
  try {
    console.log('Dynamically loading gesture module...');
    const gestureModule = await import('./gesture/index.js');
    ALEJO.modules.gesture = await gestureModule.initializeGestureSystem({
      ...options
    });
    
    return ALEJO.modules.gesture;
  } catch (error) {
    console.error('Failed to load gesture module:', error);
    ALEJO.modules.core.events.publish('gesture:load-error', {
      error: error.message,
      timestamp: Date.now()
    });
    throw error;
  }
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get configuration from data attributes
    const appElement = document.getElementById('app');
    const configUrl = appElement?.dataset?.config;
    
    let config = {};
    if (configUrl) {
      try {
        const response = await fetch(configUrl);
        config = await response.json();
      } catch (e) {
        console.warn('Failed to load external config, using defaults:', e);
      }
    }
    
    // Initialize the application with the loaded config
    await initializeApplication(config);
    
    // Set up gesture system trigger
    const gestureToggle = document.getElementById('gesture-toggle');
    if (gestureToggle) {
      gestureToggle.addEventListener('click', async () => {
        try {
          await loadGestureModule();
          ALEJO.modules.core.events.publish('gesture:toggle-requested');
        } catch (error) {
          // Error handling is done in the loadGestureModule function
        }
      });
    }
  } catch (error) {
    console.error('Application initialization failed:', error);
  }
});

// Export public API
export {
  ALEJO,
  initializeApplication,
  loadGestureModule
};
