/**
 * ALEJO ARIA Manager Tests
 * 
 * This test suite validates the functionality of the ARIA Manager,
 * ensuring proper accessibility implementation across the application.
 * 
 * @module tests/accessibility/test-aria-manager
 */

import AriaManager from '../../src/personalization/accessibility/aria-manager.js';
import { EventBus } from '../../src/core/events/event-bus.js';
import { ErrorHandler } from '../../src/core/error/error-handler.js';
import { ResourceAllocationManager } from '../../src/performance/resource-allocation-manager.js';

// Test suite for ARIA Manager
const testAriaManager = async () => {
  console.log('🧪 Starting ARIA Manager Tests');
  
  // Track test results
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  // Helper function to run a test
  const runTest = async (name, testFn) => {
    results.total++;
    try {
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      results.passed++;
      return true;
    } catch (error) {
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${error.message}`);
      results.failed++;
      return false;
    }
  };
  
  // Helper function to assert a condition
  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  };
  
  // Setup test environment
  const setupTestEnvironment = () => {
    // Create test DOM elements
    const testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
    
    // Create test button
    const testButton = document.createElement('button');
    testButton.id = 'test-button';
    testButton.textContent = 'Test Button';
    testContainer.appendChild(testButton);
    
    // Create test dialog
    const testDialog = document.createElement('div');
    testDialog.id = 'test-dialog';
    testDialog.setAttribute('role', 'dialog');
    testDialog.innerHTML = `
      <h2 id="dialog-title">Test Dialog</h2>
      <button id="dialog-close">Close</button>
      <button id="dialog-action">Action</button>
    `;
    testContainer.appendChild(testDialog);
    
    return {
      testContainer,
      testButton,
      testDialog
    };
  };
  
  // Clean up test environment
  const cleanupTestEnvironment = (elements) => {
    if (elements.testContainer && elements.testContainer.parentNode) {
      elements.testContainer.parentNode.removeChild(elements.testContainer);
    }
  };
  
  // Initialize dependencies
  let eventBus, errorHandler, resourceManager;
  
  try {
    // Get instances of dependencies
    eventBus = EventBus.getInstance();
    errorHandler = ErrorHandler.getInstance();
    resourceManager = ResourceAllocationManager.getInstance();
    
    // Initialize dependencies if needed
    if (!eventBus.initialized) {
      await eventBus.initialize();
    }
    
    if (!errorHandler.initialized) {
      await errorHandler.initialize({ eventBus });
    }
    
    if (!resourceManager.initialized) {
      await resourceManager.initialize({ eventBus, errorHandler });
    }
  } catch (error) {
    console.error('Failed to initialize dependencies:', error);
    return {
      success: false,
      error: 'Failed to initialize dependencies'
    };
  }
  
  // Create test environment
  const testElements = setupTestEnvironment();
  
  // Test: Initialize ARIA Manager
  await runTest('Initialize ARIA Manager', async () => {
    // Reset ARIA Manager instance
    AriaManager.cleanup();
    
    // Initialize with dependencies
    const success = await AriaManager.initialize({
      eventBus,
      errorHandler,
      resourceManager
    });
    
    assert(success, 'ARIA Manager initialization failed');
    assert(AriaManager.initialized, 'ARIA Manager should be marked as initialized');
    assert(AriaManager.liveRegions.size > 0, 'Live regions should be created');
  });
  
  // Test: Create live regions
  await runTest('Create live regions', () => {
    const politeRegion = AriaManager.liveRegions.get('polite');
    const assertiveRegion = AriaManager.liveRegions.get('assertive');
    
    assert(politeRegion, 'Polite live region should exist');
    assert(assertiveRegion, 'Assertive live region should exist');
    
    assert(politeRegion.getAttribute('aria-live') === 'polite', 
      'Polite region should have aria-live="polite"');
    
    assert(assertiveRegion.getAttribute('aria-live') === 'assertive', 
      'Assertive region should have aria-live="assertive"');
  });
  
  // Test: Make announcements
  await runTest('Make announcements', () => {
    const testMessage = 'This is a test announcement';
    
    // Make announcement
    AriaManager.announce(testMessage, 'polite');
    
    // Check if announcement was made
    const politeRegion = AriaManager.liveRegions.get('polite');
    
    // We need to wait for the setTimeout in the announce method
    return new Promise(resolve => {
      setTimeout(() => {
        assert(politeRegion.textContent === testMessage, 
          'Announcement should be added to the live region');
        resolve();
      }, 100);
    });
  });
  
  // Test: Update ARIA attributes
  await runTest('Update ARIA attributes', () => {
    const testButton = document.getElementById('test-button');
    
    // Update attributes
    AriaManager.updateAriaAttributes('test-button', {
      'aria-label': 'Test Button Label',
      'aria-pressed': 'false',
      'role': 'button'
    });
    
    assert(testButton.getAttribute('aria-label') === 'Test Button Label',
      'aria-label should be set correctly');
    
    assert(testButton.getAttribute('aria-pressed') === 'false',
      'aria-pressed should be set correctly');
    
    assert(testButton.getAttribute('role') === 'button',
      'role should be set correctly');
  });
  
  // Test: Register component
  await runTest('Register component', () => {
    const testButton = document.getElementById('test-button');
    
    const success = AriaManager.registerComponent('test-button-component', {
      element: testButton,
      ariaAttributes: {
        'aria-haspopup': 'true',
        'aria-expanded': 'false'
      },
      announceable: true
    });
    
    assert(success, 'Component registration should succeed');
    
    assert(testButton.getAttribute('aria-haspopup') === 'true',
      'aria-haspopup should be set correctly');
    
    assert(testButton.getAttribute('aria-expanded') === 'false',
      'aria-expanded should be set correctly');
    
    assert(AriaManager.elements.has('test-button-component'),
      'Component should be tracked in elements map');
  });
  
  // Test: Trap and release focus
  await runTest('Trap and release focus', () => {
    const testDialog = document.getElementById('test-dialog');
    
    // Trap focus
    AriaManager.trapFocus(testDialog);
    
    assert(AriaManager.keyboardTraps.includes(testDialog),
      'Dialog should be added to keyboard traps');
    
    assert(testDialog.getAttribute('aria-modal') === 'true',
      'Dialog should have aria-modal="true"');
    
    // Release focus
    AriaManager.releaseFocus(testDialog);
    
    assert(!AriaManager.keyboardTraps.includes(testDialog),
      'Dialog should be removed from keyboard traps');
    
    assert(testDialog.getAttribute('aria-modal') === 'false',
      'Dialog should have aria-modal="false"');
  });
  
  // Test: Make element keyboard navigable
  await runTest('Make element keyboard navigable', () => {
    const testContainer = document.getElementById('test-container');
    
    // Create a div that's not normally focusable
    const testDiv = document.createElement('div');
    testDiv.id = 'test-div';
    testDiv.textContent = 'Test Div';
    testContainer.appendChild(testDiv);
    
    // Make it keyboard navigable
    AriaManager.makeKeyboardNavigable(testDiv, {
      tabIndex: 0,
      role: 'button'
    });
    
    assert(testDiv.getAttribute('tabindex') === '0',
      'tabindex should be set correctly');
    
    assert(testDiv.getAttribute('role') === 'button',
      'role should be set correctly');
    
    assert(testDiv._keyHandlers && testDiv._keyHandlers.length > 0,
      'Key handlers should be attached');
    
    // Clean up
    testContainer.removeChild(testDiv);
  });
  
  // Test: Check keyboard navigability
  await runTest('Check keyboard navigability', () => {
    const testButton = document.getElementById('test-button');
    const testDialog = document.getElementById('test-dialog');
    
    assert(AriaManager.isKeyboardNavigable(testButton),
      'Button should be keyboard navigable');
    
    // A div without tabindex should not be navigable
    const testDiv = document.createElement('div');
    assert(!AriaManager.isKeyboardNavigable(testDiv),
      'Div without tabindex should not be keyboard navigable');
    
    // Make div navigable and check again
    testDiv.setAttribute('tabindex', '0');
    assert(AriaManager.isKeyboardNavigable(testDiv),
      'Div with tabindex should be keyboard navigable');
  });
  
  // Test: Unregister component
  await runTest('Unregister component', () => {
    const success = AriaManager.unregisterComponent('test-button-component');
    
    assert(success, 'Component unregistration should succeed');
    
    assert(!AriaManager.elements.has('test-button-component'),
      'Component should be removed from elements map');
  });
  
  // Test: Cleanup
  await runTest('Cleanup', () => {
    AriaManager.cleanup();
    
    assert(!AriaManager.initialized, 'ARIA Manager should be marked as not initialized');
    assert(AriaManager.elements.size === 0, 'Elements map should be empty');
    assert(AriaManager.liveRegions.size === 0, 'Live regions map should be empty');
    assert(AriaManager.keyboardTraps.length === 0, 'Keyboard traps array should be empty');
  });
  
  // Clean up test environment
  cleanupTestEnvironment(testElements);
  
  // Log test results
  console.log(`🧪 ARIA Manager Tests Complete: ${results.passed}/${results.total} tests passed`);
  
  return {
    success: results.failed === 0,
    passed: results.passed,
    failed: results.failed,
    total: results.total
  };
};

// Export the test function
export default testAriaManager;
