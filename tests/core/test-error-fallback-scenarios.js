/**
 * ALEJO Error Handling and Fallback Scenarios Test
 * 
 * This test script validates the error handling and fallback mechanisms
 * for the Resource Allocation Manager and Accessibility Integration.
 * 
 * It tests:
 * 1. Graceful handling of initialization failures
 * 2. Proper activation of fallback implementations
 * 3. Error logging and event publishing
 * 4. System stability during component failures
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
  console.log('Starting Error Handling and Fallback Scenarios Tests');
  
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
  
  // Mock event bus for tracking events
  const eventLog = [];
  const mockEventBus = {
    publish: (event, data) => {
      console.log(`Event published: ${event}`, data);
      eventLog.push({ event, data });
      return true;
    },
    subscribe: () => ({ unsubscribe: () => {} })
  };
  
  // Mock error handler for tracking errors
  const errorLog = [];
  const mockErrorHandler = {
    logError: (source, error, severity) => {
      console.error(`[${severity}] ${source}:`, error);
      errorLog.push({ source, error, severity });
      return true;
    },
    ErrorSeverity: {
      CRITICAL: 'CRITICAL',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
      INFO: 'INFO'
    }
  };
  
  try {
    // Create a new initialization manager for testing
    const testInitManager = new InitializationManager();
    
    // SECTION 1: Setup Mock Components
    createTestSection('Setup Mock Components');
    
    // Register mock error handler
    testInitManager.registerComponent(
      'error-handler',
      async () => {
        console.log('Mock error handler initialized');
        return mockErrorHandler;
      },
      [],
      10,
      false,
      () => {
        console.warn('Using built-in error handling fallback');
        return mockErrorHandler;
      }
    );
    
    // Register mock event bus
    testInitManager.registerComponent(
      'event-bus',
      async () => {
        console.log('Mock event bus initialized');
        return mockEventBus;
      },
      ['error-handler'],
      9,
      false,
      () => {
        console.warn('Using simplified event bus fallback');
        return mockEventBus;
      }
    );
    
    // SECTION 2: Resource Manager Failure Scenario
    createTestSection('Resource Manager Failure Scenario');
    
    // Register failing resource manager
    testInitManager.registerComponent(
      'resource-allocation-manager',
      async () => {
        console.log('Simulating Resource Manager initialization failure...');
        throw new Error('Simulated Resource Manager initialization failure');
      },
      ['error-handler', 'event-bus'],
      8,
      false,
      createFallbackResourceManager
    );
    
    // Test 1: Initialize resource manager with failure
    try {
      await testInitManager.initializeComponent('resource-allocation-manager');
      reportTestResult('Resource Manager Fallback', false, 'Should have thrown an error');
    } catch (error) {
      // Expected error, now check if fallback was used
      const resourceManager = testInitManager.getInitializedComponent('resource-allocation-manager');
      
      reportTestResult(
        'Resource Manager Fallback', 
        resourceManager && resourceManager.currentMode === 'CONSERVATIVE',
        'Fallback resource manager not activated'
      );
    }
    
    // Test 2: Check error logging
    const resourceManagerErrors = errorLog.filter(e => 
      e.source.includes('resource-allocation-manager')
    );
    
    reportTestResult(
      'Resource Manager Error Logged', 
      resourceManagerErrors.length > 0,
      'No error logged for resource manager failure'
    );
    
    // Test 3: Check event publishing
    const resourceManagerEvents = eventLog.filter(e => 
      e.event.includes('initialization.failure') && 
      e.data && e.data.component === 'resource-allocation-manager'
    );
    
    reportTestResult(
      'Resource Manager Failure Event', 
      resourceManagerEvents.length > 0,
      'No failure event published for resource manager'
    );
    
    // Clear logs for next test
    errorLog.length = 0;
    eventLog.length = 0;
    
    // SECTION 3: Accessibility Integration Failure Scenario
    createTestSection('Accessibility Integration Failure Scenario');
    
    // Register failing accessibility integration
    testInitManager.registerComponent(
      'accessibility-integration',
      async () => {
        console.log('Simulating Accessibility Integration initialization failure...');
        throw new Error('Simulated Accessibility Integration initialization failure');
      },
      ['error-handler', 'event-bus', 'resource-allocation-manager'],
      7,
      true, // Mark as accessibility component for prioritization
      createFallbackAccessibilityIntegration
    );
    
    // Test 4: Initialize accessibility integration with failure
    try {
      await testInitManager.initializeComponent('accessibility-integration');
      reportTestResult('Accessibility Integration Fallback', false, 'Should have thrown an error');
    } catch (error) {
      // Expected error, now check if fallback was used
      const accessibilityComponent = testInitManager.getInitializedComponent('accessibility-integration');
      
      reportTestResult(
        'Accessibility Integration Fallback', 
        accessibilityComponent && typeof accessibilityComponent.announce === 'function',
        'Fallback accessibility integration not activated'
      );
    }
    
    // Test 5: Check error logging
    const accessibilityErrors = errorLog.filter(e => 
      e.source.includes('accessibility-integration')
    );
    
    reportTestResult(
      'Accessibility Error Logged', 
      accessibilityErrors.length > 0,
      'No error logged for accessibility integration failure'
    );
    
    // Test 6: Check event publishing
    const accessibilityEvents = eventLog.filter(e => 
      e.event.includes('initialization.failure') && 
      e.data && e.data.component === 'accessibility-integration'
    );
    
    reportTestResult(
      'Accessibility Failure Event', 
      accessibilityEvents.length > 0,
      'No failure event published for accessibility integration'
    );
    
    // SECTION 4: Fallback Functionality Tests
    createTestSection('Fallback Functionality Tests');
    
    // Get the fallback implementations
    const fallbackResourceManager = testInitManager.getInitializedComponent('resource-allocation-manager');
    const fallbackAccessibility = testInitManager.getInitializedComponent('accessibility-integration');
    
    // Test 7: Resource Manager Fallback API
    try {
      const registered = fallbackResourceManager.registerComponent('test-component', {
        cpuPriority: 5,
        memoryFootprint: 10,
        isEssential: false
      });
      
      const usage = fallbackResourceManager.getResourceUsage();
      
      reportTestResult(
        'Resource Manager Fallback API', 
        registered === true && usage && typeof usage === 'object',
        'Fallback resource manager API not working correctly'
      );
    } catch (error) {
      reportTestResult('Resource Manager Fallback API', false, error.message);
    }
    
    // Test 8: Accessibility Integration Fallback API
    try {
      const announced = fallbackAccessibility.announce('Test announcement');
      const featureToggled = fallbackAccessibility.toggleFeature('highContrast', true);
      
      reportTestResult(
        'Accessibility Fallback API', 
        announced !== undefined && featureToggled !== undefined,
        'Fallback accessibility API not working correctly'
      );
    } catch (error) {
      reportTestResult('Accessibility Fallback API', false, error.message);
    }
    
    // SECTION 5: Retry Mechanism Test
    createTestSection('Retry Mechanism Test');
    
    // Create a component that fails on first attempt but succeeds on retry
    let attemptCount = 0;
    testInitManager.registerComponent(
      'retry-test-component',
      async () => {
        attemptCount++;
        console.log(`Retry test component attempt ${attemptCount}`);
        
        if (attemptCount === 1) {
          throw new Error('First attempt failure (expected)');
        }
        
        return {
          name: 'retry-test-component',
          status: 'initialized'
        };
      },
      ['error-handler'],
      5,
      false,
      () => ({ name: 'retry-test-fallback', status: 'fallback' })
    );
    
    // Test 9: Component with retry
    try {
      // Configure retry attempts
      testInitManager.setComponentRetryAttempts('retry-test-component', 3);
      
      // Initialize with retry
      await testInitManager.initializeComponent('retry-test-component');
      
      const component = testInitManager.getInitializedComponent('retry-test-component');
      
      reportTestResult(
        'Retry Mechanism', 
        attemptCount === 2 && component && component.status === 'initialized',
        'Retry mechanism not working correctly'
      );
    } catch (error) {
      reportTestResult('Retry Mechanism', false, error.message);
    }
    
    // SECTION 6: Accessibility Prioritization Test
    createTestSection('Accessibility Prioritization Test');
    
    // Register a regular component and an accessibility component with same base priority
    testInitManager.registerComponent(
      'regular-component',
      async () => ({ type: 'regular' }),
      [],
      5,
      false,
      () => ({ type: 'regular-fallback' })
    );
    
    testInitManager.registerComponent(
      'accessibility-component',
      async () => ({ type: 'accessibility' }),
      [],
      5,
      true, // Mark as accessibility
      () => ({ type: 'accessibility-fallback' })
    );
    
    // Test 10: Calculate initialization order with accessibility prioritization
    const initOrder = testInitManager.calculateInitializationOrder();
    console.log('Initialization order:', initOrder);
    
    // Find the indices of our test components
    const regularIndex = initOrder.indexOf('regular-component');
    const accessibilityIndex = initOrder.indexOf('accessibility-component');
    
    reportTestResult(
      'Accessibility Prioritization', 
      accessibilityIndex < regularIndex,
      'Accessibility component not prioritized over regular component with same base priority'
    );
    
    // SECTION 7: Summary
    createTestSection('Test Summary');
    console.log('All error handling and fallback tests completed!');
    
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Run tests when the page loads
document.addEventListener('DOMContentLoaded', runTests);

// Export test functions for external use
export { runTests };
