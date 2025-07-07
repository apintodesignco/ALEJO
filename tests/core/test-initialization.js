/**
 * ALEJO Core Initialization Test Script
 * 
 * This script tests the new error handling, initialization manager, and monitoring dashboard
 * to ensure they work correctly together and provide robust initialization with fallbacks.
 */

// Import necessary modules
import { 
  initializeCore, 
  logError, 
  ErrorSeverity, 
  getSystemStatus,
  getMonitoringDashboard,
  registerComponent,
  initializeWithFallback
} from '../../src/core/index.js';

// Mock components for testing
const mockComponents = {
  // Component that initializes successfully
  successComponent: {
    id: 'test:success',
    initFunction: async () => {
      console.log('Success component initialized');
      return { status: 'success' };
    },
    isEssential: false,
    priority: 50
  },
  
  // Component that fails but has a fallback
  fallbackComponent: {
    id: 'test:fallback',
    initFunction: async () => {
      throw new Error('Simulated failure');
    },
    fallbackFunction: async () => {
      console.log('Using fallback implementation');
      return { status: 'fallback' };
    },
    isEssential: true,
    priority: 80
  },
  
  // Component with dependencies
  dependentComponent: {
    id: 'test:dependent',
    initFunction: async () => {
      console.log('Dependent component initialized');
      return { status: 'success' };
    },
    dependencies: ['test:success'],
    isEssential: false,
    priority: 30
  },
  
  // Component that fails without fallback
  failingComponent: {
    id: 'test:failing',
    initFunction: async () => {
      throw new Error('Simulated critical failure');
    },
    isEssential: false,
    priority: 20
  },
  
  // Accessibility component with highest priority
  accessibilityComponent: {
    id: 'test:accessibility',
    initFunction: async () => {
      console.log('Accessibility component initialized');
      return { status: 'success' };
    },
    isEssential: true,
    isAccessibility: true,
    priority: 100
  }
};

/**
 * Run the initialization tests
 */
async function runTests() {
  console.log('=== ALEJO Core Initialization Tests ===');
  
  try {
    // Test 1: Register components
    console.log('\n--- Test 1: Component Registration ---');
    Object.values(mockComponents).forEach(component => {
      registerComponent(component);
      console.log(`Registered component: ${component.id}`);
    });
    
    // Test 2: Initialize core with monitoring
    console.log('\n--- Test 2: Core Initialization ---');
    const initResult = await initializeCore({
      showDashboard: false,
      enableFallbacks: true
    });
    
    console.log('Initialization result:', initResult.success ? 'SUCCESS' : 'FAILURE');
    
    // Test 3: Check component status
    console.log('\n--- Test 3: Component Status Check ---');
    const systemStatus = getSystemStatus();
    console.log('System initialization status:', systemStatus.isInitialized ? 'INITIALIZED' : 'FAILED');
    
    console.log('\nComponent Status:');
    Object.entries(systemStatus.components).forEach(([id, status]) => {
      console.log(`- ${id}: ${status.status} (Essential: ${status.isEssential}, Priority: ${status.priority})`);
    });
    
    // Test 4: Test error logging
    console.log('\n--- Test 4: Error Logging ---');
    logError('test:error-handler', new Error('Test error message'), ErrorSeverity.MEDIUM);
    console.log('Error logged successfully');
    
    // Test 5: Test fallback mechanism directly
    console.log('\n--- Test 5: Direct Fallback Test ---');
    const fallbackResult = await initializeWithFallback(
      'test:direct-fallback',
      async () => {
        throw new Error('Direct fallback test error');
      },
      async () => {
        console.log('Direct fallback function executed');
        return { status: 'direct-fallback-success' };
      },
      { isEssential: true }
    );
    
    console.log('Direct fallback result:', fallbackResult);
    
    // Test 6: Show monitoring dashboard
    console.log('\n--- Test 6: Monitoring Dashboard ---');
    const dashboard = getMonitoringDashboard();
    dashboard.init({ autoShow: false });
    console.log('Dashboard initialized, toggle button created');
    
    // Test complete
    console.log('\n=== All tests completed ===');
    console.log('Check the browser console for any errors');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the tests when the page loads
window.addEventListener('DOMContentLoaded', () => {
  // Create a container for test output
  const container = document.createElement('div');
  container.id = 'test-container';
  container.style.padding = '20px';
  container.style.fontFamily = 'monospace';
  container.style.whiteSpace = 'pre-wrap';
  container.innerHTML = '<h1>ALEJO Core Initialization Tests</h1><div id="test-output"></div>';
  document.body.appendChild(container);
  
  // Redirect console output to the page
  const output = document.getElementById('test-output');
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    const line = document.createElement('div');
    line.textContent = args.join(' ');
    output.appendChild(line);
  };
  
  console.error = function(...args) {
    originalConsoleError.apply(console, args);
    const line = document.createElement('div');
    line.textContent = args.join(' ');
    line.style.color = 'red';
    output.appendChild(line);
  };
  
  // Run the tests
  runTests();
});
