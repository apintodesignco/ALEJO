/**
 * ALEJO Initialization System Test Script
 * 
 * This script tests the initialization system by registering test components
 * with different priorities, dependencies, and accessibility requirements,
 * and then initializing them to demonstrate the progressive loading sequence
 * and fallback mechanisms.
 */

import { 
  registerComponent, 
  initializeSystem,
  getInitializationStatus
} from './initialization-manager.js';

import { 
  registerFallbackImplementation,
  createAccessibilityFallback,
  generateStubImplementation
} from './fallback-manager.js';

import { initializeProgressiveLoading } from './progressive-loading-manager.js';
import { logInitEvent } from './initialization-log-viewer.js';
import { openMonitoringDashboard } from './monitoring-dashboard.js';

/**
 * Run the initialization system test
 */
export async function runInitializationTest() {
  console.log('Starting ALEJO initialization system test...');
  
  // Register test components
  registerTestComponents();
  
  // Open the monitoring dashboard
  openMonitoringDashboard();
  
  // Initialize the progressive loading manager
  await initializeProgressiveLoading({
    userPreferences: {
      prioritizeAccessibility: true,
      loadOptionalComponents: true,
      resourceConservationMode: false
    }
  });
  
  // Initialize the system
  try {
    await initializeSystem();
    console.log('Initialization completed successfully');
  } catch (error) {
    console.error('Initialization failed:', error);
  }
  
  // Log final status
  const finalStatus = getInitializationStatus();
  console.log('Final initialization status:', finalStatus);
  
  return finalStatus;
}

/**
 * Register test components with the initialization manager
 */
function registerTestComponents() {
  // Register accessibility components (highest priority)
  registerAccessibilityComponents();
  
  // Register core components
  registerCoreComponents();
  
  // Register standard components
  registerStandardComponents();
  
  // Register optional components
  registerOptionalComponents();
}

/**
 * Register accessibility components
 */
function registerAccessibilityComponents() {
  // Screen reader support
  registerComponent('a11y.screenReader', {
    initFunction: createDelayedInit('a11y.screenReader', 500),
    fallbackFunction: createAccessibilityFallback(
      'a11y.screenReader',
      createDelayedInit('a11y.screenReader.fallback', 200),
      { announcements: true, screenReaderHints: true }
    ),
    dependencies: [],
    isEssential: true,
    accessibility: true,
    priority: 1000,
    retryAttempts: 3
  });
  
  // Keyboard navigation
  registerComponent('a11y.keyboardNavigation', {
    initFunction: createDelayedInit('a11y.keyboardNavigation', 300),
    fallbackFunction: createAccessibilityFallback(
      'a11y.keyboardNavigation',
      createDelayedInit('a11y.keyboardNavigation.fallback', 100),
      { keyboardSupport: true }
    ),
    dependencies: [],
    isEssential: true,
    accessibility: true,
    priority: 1000,
    retryAttempts: 2
  });
  
  // High contrast mode
  registerComponent('a11y.highContrast', {
    initFunction: createDelayedInit('a11y.highContrast', 200),
    fallbackFunction: createAccessibilityFallback(
      'a11y.highContrast',
      createDelayedInit('a11y.highContrast.fallback', 100),
      { highContrast: true }
    ),
    dependencies: [],
    isEssential: true,
    accessibility: true,
    priority: 1000,
    retryAttempts: 2
  });
  
  // Voice control (will fail to demonstrate fallback)
  registerComponent('a11y.voiceControl', {
    initFunction: createFailingInit('a11y.voiceControl', 'Voice recognition not available'),
    fallbackFunction: createAccessibilityFallback(
      'a11y.voiceControl',
      createDelayedInit('a11y.voiceControl.fallback', 300),
      { announcements: true }
    ),
    dependencies: ['a11y.screenReader'],
    isEssential: false,
    accessibility: true,
    priority: 900,
    retryAttempts: 2
  });
}

/**
 * Register core components
 */
function registerCoreComponents() {
  // User interface core
  registerComponent('core.ui', {
    initFunction: createDelayedInit('core.ui', 400),
    fallbackFunction: createDelayedInit('core.ui.fallback', 200),
    dependencies: ['a11y.keyboardNavigation', 'a11y.highContrast'],
    isEssential: true,
    accessibility: false,
    priority: 800,
    retryAttempts: 2
  });
  
  // Data manager
  registerComponent('core.dataManager', {
    initFunction: createDelayedInit('core.dataManager', 600),
    fallbackFunction: generateStubImplementation('core.dataManager', {
      methods: ['getData', 'setData', 'clearData'],
      properties: ['isReady', 'lastUpdated'],
      events: ['dataChanged', 'dataLoaded']
    }),
    dependencies: [],
    isEssential: true,
    accessibility: false,
    priority: 800,
    retryAttempts: 2
  });
  
  // Event system
  registerComponent('core.eventSystem', {
    initFunction: createDelayedInit('core.eventSystem', 300),
    fallbackFunction: null, // No fallback to demonstrate failure
    dependencies: [],
    isEssential: true,
    accessibility: false,
    priority: 850,
    retryAttempts: 1
  });
}

/**
 * Register standard components
 */
function registerStandardComponents() {
  // User preferences
  registerComponent('standard.userPreferences', {
    initFunction: createDelayedInit('standard.userPreferences', 500),
    fallbackFunction: createDelayedInit('standard.userPreferences.fallback', 200),
    dependencies: ['core.dataManager'],
    isEssential: false,
    accessibility: false,
    priority: 600,
    retryAttempts: 2
  });
  
  // Notification system
  registerComponent('standard.notifications', {
    initFunction: createDelayedInit('standard.notifications', 400),
    fallbackFunction: createDelayedInit('standard.notifications.fallback', 200),
    dependencies: ['core.ui', 'core.eventSystem'],
    isEssential: false,
    accessibility: false,
    priority: 600,
    retryAttempts: 2
  });
  
  // Analytics
  registerComponent('standard.analytics', {
    initFunction: createFailingInit('standard.analytics', 'Network error'),
    fallbackFunction: generateStubImplementation('standard.analytics', {
      methods: ['trackEvent', 'trackPageView', 'setUserProperty'],
      properties: ['isEnabled'],
      events: []
    }),
    dependencies: ['core.eventSystem'],
    isEssential: false,
    accessibility: false,
    priority: 500,
    retryAttempts: 3
  });
}

/**
 * Register optional components
 */
function registerOptionalComponents() {
  // Theme manager
  registerComponent('optional.themeManager', {
    initFunction: createDelayedInit('optional.themeManager', 700),
    fallbackFunction: createDelayedInit('optional.themeManager.fallback', 300),
    dependencies: ['core.ui', 'standard.userPreferences'],
    isEssential: false,
    accessibility: false,
    priority: 400,
    retryAttempts: 1
  });
  
  // Tour guide
  registerComponent('optional.tourGuide', {
    initFunction: createDelayedInit('optional.tourGuide', 800),
    fallbackFunction: null,
    dependencies: ['core.ui', 'standard.notifications'],
    isEssential: false,
    accessibility: false,
    priority: 300,
    retryAttempts: 1
  });
  
  // Feedback system
  registerComponent('optional.feedback', {
    initFunction: createDelayedInit('optional.feedback', 600),
    fallbackFunction: null,
    dependencies: ['core.ui', 'standard.notifications', 'standard.analytics'],
    isEssential: false,
    accessibility: false,
    priority: 200,
    retryAttempts: 1
  });
}

/**
 * Create a delayed initialization function for testing
 * 
 * @param {string} componentId - Component ID
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Initialization function
 */
function createDelayedInit(componentId, delay) {
  return () => {
    return new Promise((resolve) => {
      console.log(`Initializing ${componentId} (delay: ${delay}ms)...`);
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        const progress = Math.random() * 100;
        const phases = ['starting', 'loading', 'configuring', 'finalizing'];
        const phase = phases[Math.floor(Math.random() * phases.length)];
        
        // This would be captured by the initialization manager's onProgress handler
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('component:progress', {
            detail: { componentId, progress, phase }
          }));
        }
      }, delay / 4);
      
      setTimeout(() => {
        clearInterval(progressInterval);
        console.log(`${componentId} initialized successfully`);
        resolve({ 
          id: componentId,
          status: 'ready',
          timestamp: Date.now()
        });
      }, delay);
    });
  };
}

/**
 * Create a failing initialization function for testing
 * 
 * @param {string} componentId - Component ID
 * @param {string} errorMessage - Error message
 * @returns {Function} - Initialization function that fails
 */
function createFailingInit(componentId, errorMessage) {
  return () => {
    return new Promise((resolve, reject) => {
      console.log(`Initializing ${componentId} (will fail)...`);
      
      setTimeout(() => {
        console.error(`${componentId} initialization failed: ${errorMessage}`);
        reject(new Error(errorMessage));
      }, 500);
    });
  };
}

// Run the test if this script is executed directly
if (typeof window !== 'undefined' && window.location.search.includes('runTest=true')) {
  runInitializationTest().catch(console.error);
}
