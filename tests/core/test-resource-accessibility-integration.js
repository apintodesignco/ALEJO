/**
 * ALEJO Resource and Accessibility Integration Test
 * 
 * This test script validates the integration of the Resource Allocation Manager
 * and Accessibility Integration with the new initialization system.
 * 
 * It tests:
 * 1. Registration of components with the initialization manager
 * 2. Proper initialization order based on dependencies
 * 3. Fallback mechanisms when initialization fails
 * 4. Accessibility-first prioritization
 * 5. Resource management integration
 */

import { 
  initializeCore, 
  getSystemStatus,
  getMonitoringDashboard
} from '../../src/core/index.js';

import { 
  logError, 
  ErrorSeverity,
  getComponentStatus
} from '../../src/core/system/error-handler.js';

import { 
  InitializationManager 
} from '../../src/core/system/initialization-manager.js';

import { 
  getResourceAllocationManager, 
  createFallbackResourceManager 
} from '../../src/performance/resource-allocation-manager.js';

import accessibilityIntegration, { 
  createFallbackAccessibilityIntegration 
} from '../../src/personalization/accessibility/accessibility-integration.js';

// Redirect console output to the page for visual testing
const consoleOutput = document.getElementById('console-output');
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// Override console methods to display in the UI
console.log = function(...args) {
  originalConsole.log(...args);
  appendToConsole('log', ...args);
};

console.error = function(...args) {
  originalConsole.error(...args);
  appendToConsole('error', ...args);
};

console.warn = function(...args) {
  originalConsole.warn(...args);
  appendToConsole('warn', ...args);
};

console.info = function(...args) {
  originalConsole.info(...args);
  appendToConsole('info', ...args);
};

// Helper function to append console output to the UI
function appendToConsole(type, ...args) {
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  
  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toISOString().substr(11, 8) + ' ';
  line.appendChild(timestamp);
  
  const typeIndicator = document.createElement('span');
  typeIndicator.className = 'type';
  typeIndicator.textContent = `[${type.toUpperCase()}] `;
  line.appendChild(typeIndicator);
  
  const content = document.createElement('span');
  content.className = 'content';
  content.textContent = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  line.appendChild(content);
  
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Test runner
async function runTests() {
  console.log('Starting Resource and Accessibility Integration Tests');
  
  // Create a test section header
  function createTestSection(title) {
    console.log('\n' + '='.repeat(50));
    console.log(`TEST SECTION: ${title}`);
    console.log('='.repeat(50));
  }
  
  // Test result reporting
  function reportTestResult(testName, success, message) {
    if (success) {
      console.log(`✅ PASS: ${testName}`);
    } else {
      console.error(`❌ FAIL: ${testName} - ${message}`);
    }
  }
  
  try {
    // Create a new initialization manager for testing
    const testInitManager = new InitializationManager();
    
    // SECTION 1: Component Registration
    createTestSection('Component Registration');
    
    // Test 1: Register Resource Allocation Manager
    try {
      testInitManager.registerComponent(
        'resource-allocation-manager',
        async () => {
          const resourceManager = getResourceAllocationManager();
          await resourceManager.initialize();
          return resourceManager;
        },
        ['error-handler', 'event-bus'],
        8,
        false,
        createFallbackResourceManager
      );
      reportTestResult('Register Resource Manager', true);
    } catch (error) {
      reportTestResult('Register Resource Manager', false, error.message);
    }
    
    // Test 2: Register Accessibility Integration
    try {
      testInitManager.registerComponent(
        'accessibility-integration',
        async () => {
          await accessibilityIntegration.initialize({
            showWelcomeMessage: false // Disable welcome message for testing
          });
          return accessibilityIntegration;
        },
        ['error-handler', 'event-bus', 'resource-allocation-manager'],
        7,
        true, // Mark as accessibility component for prioritization
        createFallbackAccessibilityIntegration
      );
      reportTestResult('Register Accessibility Integration', true);
    } catch (error) {
      reportTestResult('Register Accessibility Integration', false, error.message);
    }
    
    // SECTION 2: Mock Dependencies
    createTestSection('Mock Dependencies');
    
    // Register mock error handler
    testInitManager.registerComponent(
      'error-handler',
      async () => {
        console.log('Mock error handler initialized');
        return {
          logError: (source, error, severity) => console.error(`[${severity}] ${source}:`, error),
          ErrorSeverity: {
            CRITICAL: 'CRITICAL',
            HIGH: 'HIGH',
            MEDIUM: 'MEDIUM',
            LOW: 'LOW',
            INFO: 'INFO'
          }
        };
      },
      [],
      10,
      false,
      () => {
        console.warn('Using built-in error handling fallback');
        return {
          logError: (source, error, severity) => console.error(`[${severity}] ${source}:`, error),
          ErrorSeverity: {
            CRITICAL: 'CRITICAL',
            HIGH: 'HIGH',
            MEDIUM: 'MEDIUM',
            LOW: 'LOW',
            INFO: 'INFO'
          }
        };
      }
    );
    
    // Register mock event bus
    testInitManager.registerComponent(
      'event-bus',
      async () => {
        console.log('Mock event bus initialized');
        return {
          publish: (event, data) => console.log(`Event published: ${event}`, data),
          subscribe: () => ({ unsubscribe: () => {} })
        };
      },
      ['error-handler'],
      9,
      false,
      () => {
        console.warn('Using simplified event bus fallback');
        return {
          publish: (event, data) => console.log(`Event: ${event}`, data),
          subscribe: () => ({ unsubscribe: () => {} })
        };
      }
    );
    
    // SECTION 3: Initialization Order
    createTestSection('Initialization Order');
    
    // Test 3: Calculate initialization order
    const initOrder = testInitManager.calculateInitializationOrder();
    console.log('Initialization order:', initOrder);
    
    const correctOrder = initOrder[0] === 'error-handler' && 
                         initOrder[1] === 'event-bus' && 
                         initOrder[2] === 'resource-allocation-manager' && 
                         initOrder[3] === 'accessibility-integration';
                         
    reportTestResult('Initialization Order', correctOrder, 'Components not in correct dependency order');
    
    // Test 4: Accessibility prioritization
    const components = testInitManager.getRegisteredComponents();
    const accessibilityComponent = components.find(c => c.id === 'accessibility-integration');
    
    reportTestResult(
      'Accessibility Prioritization', 
      accessibilityComponent && accessibilityComponent.isAccessibility === true,
      'Accessibility component not marked correctly'
    );
    
    // SECTION 4: Component Initialization
    createTestSection('Component Initialization');
    
    // Test 5: Initialize all components
    try {
      await testInitManager.initializeAllComponents();
      const status = testInitManager.getInitializationStatus();
      
      reportTestResult(
        'All Components Initialized', 
        status.completedComponents.length === 4,
        `Only ${status.completedComponents.length}/4 components initialized`
      );
    } catch (error) {
      reportTestResult('All Components Initialized', false, error.message);
    }
    
    // SECTION 5: Resource Manager Integration
    createTestSection('Resource Manager Integration');
    
    // Test 6: Resource Manager API
    const resourceManager = testInitManager.getInitializedComponent('resource-allocation-manager');
    
    reportTestResult(
      'Resource Manager API', 
      resourceManager && 
      typeof resourceManager.registerComponent === 'function' &&
      typeof resourceManager.getResourceUsage === 'function',
      'Resource Manager missing expected API methods'
    );
    
    // Test 7: Register a test component with Resource Manager
    try {
      const registered = resourceManager.registerComponent('test-component', {
        cpuPriority: 5,
        memoryFootprint: 10,
        isEssential: false,
        pauseCallback: () => console.log('Test component paused'),
        resumeCallback: () => console.log('Test component resumed')
      });
      
      reportTestResult('Register with Resource Manager', registered === true);
    } catch (error) {
      reportTestResult('Register with Resource Manager', false, error.message);
    }
    
    // SECTION 6: Accessibility Integration
    createTestSection('Accessibility Integration');
    
    // Test 8: Accessibility API
    const accessibilityIntegration = testInitManager.getInitializedComponent('accessibility-integration');
    
    reportTestResult(
      'Accessibility API', 
      accessibilityIntegration && 
      typeof accessibilityIntegration.toggleFeature === 'function' &&
      typeof accessibilityIntegration.announce === 'function',
      'Accessibility Integration missing expected API methods'
    );
    
    // Test 9: Toggle an accessibility feature
    try {
      const result = accessibilityComponent.toggleFeature('highContrast', true);
      reportTestResult('Toggle Accessibility Feature', result !== undefined);
    } catch (error) {
      reportTestResult('Toggle Accessibility Feature', false, error.message);
    }
    
    // SECTION 7: Fallback Mechanisms
    createTestSection('Fallback Mechanisms');
    
    // Test 10: Create fallback resource manager
    const fallbackResourceManager = createFallbackResourceManager();
    
    reportTestResult(
      'Fallback Resource Manager', 
      fallbackResourceManager && 
      typeof fallbackResourceManager.registerComponent === 'function' &&
      fallbackResourceManager.currentMode === 'CONSERVATIVE',
      'Fallback Resource Manager missing expected properties'
    );
    
    // Test 11: Create fallback accessibility integration
    const fallbackAccessibility = createFallbackAccessibilityIntegration();
    
    reportTestResult(
      'Fallback Accessibility', 
      fallbackAccessibility && 
      typeof fallbackAccessibility.toggleFeature === 'function' &&
      typeof fallbackAccessibility.announce === 'function',
      'Fallback Accessibility missing expected methods'
    );
    
    // SECTION 8: Summary
    createTestSection('Test Summary');
    console.log('All tests completed!');
    
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Run tests when the page loads
document.addEventListener('DOMContentLoaded', runTests);

// Export test functions for external use
export { runTests };
