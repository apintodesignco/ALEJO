/**
 * ALEJO Accessibility Integration Test Script
 * 
 * This script tests the integration between multiple accessibility features:
 * - Font scaling
 * - High contrast mode
 * - ARIA announcements
 * 
 * It validates that these features work well independently and in combination.
 * The test confirms proper initialization, state changes, event handling,
 * and configuration persistence.
 */

import { eventEmitter } from '../src/core/event-emitter.js';
import { fontScalingManager } from '../src/personalization/accessibility/font-scaling-manager.js';
import { highContrastManager } from '../src/personalization/accessibility/high-contrast-manager.js';
import { ariaManager } from '../src/personalization/accessibility/aria-manager.js';

// Configuration for tests
const config = {
  testDuration: 20000, // 20 seconds to run all tests
  testInterval: 1000, // 1 second between test steps
  ariaAnnounceDelay: 250, // Delay for ARIA announcements
  fontScaleLevels: [0.85, 1, 1.15, 1.5, 1.7] // Levels to test
};

// Test state
const testState = {
  running: false,
  startTime: null,
  currentStep: 0,
  results: {
    passed: 0,
    failed: 0,
    total: 0,
    log: []
  },
  assertions: 0
};

/**
 * Initialize test components and start the test sequence
 */
async function runTests() {
  testState.running = true;
  testState.startTime = Date.now();
  
  log('Starting ALEJO Accessibility Integration Tests');
  log('--------------------------------------------');
  
  try {
    // Initialize components
    await initializeComponents();
    
    // Start the test sequence
    await runTestSequence();
    
    // Show summary
    showSummary();
  } catch (error) {
    log(`Test execution error: ${error.message}`, 'error');
    log(`Stack trace: ${error.stack}`, 'error');
    showSummary();
  }
}

/**
 * Initialize all accessibility components for testing
 */
async function initializeComponents() {
  log('Initializing accessibility components...');
  
  try {
    // Mock config manager if needed in the test environment
    if (typeof window.mockConfigStorage === 'function') {
      window.mockConfigStorage();
    }
    
    // Initialize font scaling manager
    await fontScalingManager.initialize({
      applyImmediately: false // Don't apply until tests explicitly do so
    });
    log('Font scaling manager initialized', 'success');
    
    // Initialize high contrast manager
    await highContrastManager.initialize({
      applyImmediately: false // Don't apply until tests explicitly do so
    });
    log('High contrast manager initialized', 'success');
    
    // Make sure ARIA announcer element exists
    setupAriaAnnouncer();
    log('ARIA announcer element created', 'success');
    
    return true;
  } catch (error) {
    log(`Component initialization error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Run the test sequence for all accessibility features
 */
async function runTestSequence() {
  // Test 1: Font Scaling Tests
  await testFontScaling();
  
  // Test 2: High Contrast Tests
  await testHighContrast();
  
  // Test 3: Combined Feature Tests
  await testCombinedFeatures();
  
  // Test 4: Persistence Tests
  await testPersistence();
  
  // Test 5: ARIA Announcement Tests
  await testAriaAnnouncements();
  
  // Test 6: Event Emission Tests
  await testEventEmissions();
}

/**
 * Test font scaling functionality
 */
async function testFontScaling() {
  log('Beginning Font Scaling Tests');
  
  // Test setting specific font scales
  for (const level of config.fontScaleLevels) {
    const result = fontScalingManager.setFontScaling(level);
    assert(result === level, `Font scale should be set to ${level}`);
    
    const currentLevel = fontScalingManager.getCurrentScalingLevel();
    assert(currentLevel === level, `getCurrentScalingLevel() should return ${level}`);
    
    // Check if HTML class is applied correctly
    const hasClass = document.documentElement.classList.contains('alejo-font-scaled');
    assert(level !== 1 ? hasClass : !hasClass, 'Font scaling class should be applied correctly');
    
    await delay(200); // Small delay between tests
  }
  
  // Test increasing font scaling
  const beforeIncrease = fontScalingManager.getCurrentScalingLevel();
  fontScalingManager.increaseFontScaling();
  const afterIncrease = fontScalingManager.getCurrentScalingLevel();
  assert(afterIncrease > beforeIncrease, 'Font scaling should increase');
  
  // Test decreasing font scaling
  const beforeDecrease = fontScalingManager.getCurrentScalingLevel();
  fontScalingManager.decreaseFontScaling();
  const afterDecrease = fontScalingManager.getCurrentScalingLevel();
  assert(afterDecrease < beforeDecrease, 'Font scaling should decrease');
  
  // Test resetting to default
  fontScalingManager.resetFontScaling();
  const afterReset = fontScalingManager.getCurrentScalingLevel();
  assert(afterReset === 1, 'Font scaling should reset to 1 (100%)');
  
  // Check presets
  const presets = fontScalingManager.getScalingPresets();
  assert(typeof presets === 'object' && Object.keys(presets).length > 0, 'Should return scaling presets');
  
  log('Font Scaling Tests Completed', 'success');
}

/**
 * Test high contrast functionality
 */
async function testHighContrast() {
  log('Beginning High Contrast Tests');
  
  // Test initial state (should be disabled by default)
  const initialState = highContrastManager.isHighContrastEnabled();
  log(`Initial high contrast state: ${initialState}`);
  
  // Enable high contrast
  highContrastManager.setHighContrast(true);
  assert(highContrastManager.isHighContrastEnabled() === true, 'High contrast should be enabled');
  
  // Check if HTML class is applied
  assert(document.documentElement.classList.contains('alejo-high-contrast'), 
    'High contrast class should be applied');
  
  // Disable high contrast
  highContrastManager.setHighContrast(false);
  assert(highContrastManager.isHighContrastEnabled() === false, 'High contrast should be disabled');
  
  // Check if HTML class is removed
  assert(!document.documentElement.classList.contains('alejo-high-contrast'), 
    'High contrast class should be removed');
  
  // Test toggle functionality
  const beforeToggle = highContrastManager.isHighContrastEnabled();
  highContrastManager.toggleHighContrast();
  const afterToggle = highContrastManager.isHighContrastEnabled();
  assert(beforeToggle !== afterToggle, 'Toggle should change high contrast state');
  
  log('High Contrast Tests Completed', 'success');
}

/**
 * Test combination of multiple accessibility features
 */
async function testCombinedFeatures() {
  log('Beginning Combined Feature Tests');
  
  // Enable both features
  fontScalingManager.setFontScaling(1.5);
  highContrastManager.setHighContrast(true);
  
  assert(fontScalingManager.getCurrentScalingLevel() === 1.5, 
    'Font scaling should be 1.5 with high contrast enabled');
  assert(highContrastManager.isHighContrastEnabled() === true, 
    'High contrast should remain enabled with font scaling');
  
  // Check correct CSS classes
  assert(document.documentElement.classList.contains('alejo-font-scaled'), 
    'Font scaling class should be applied');
  assert(document.documentElement.classList.contains('alejo-high-contrast'), 
    'High contrast class should be applied');
  
  // Disable both features
  fontScalingManager.resetFontScaling();
  highContrastManager.setHighContrast(false);
  
  assert(fontScalingManager.getCurrentScalingLevel() === 1, 
    'Font scaling should reset to 1');
  assert(highContrastManager.isHighContrastEnabled() === false, 
    'High contrast should be disabled');
  
  // Check CSS classes removed
  assert(!document.documentElement.classList.contains('alejo-font-scaled'), 
    'Font scaling class should be removed');
  assert(!document.documentElement.classList.contains('alejo-high-contrast'), 
    'High contrast class should be removed');
  
  log('Combined Feature Tests Completed', 'success');
}

/**
 * Test persistence of settings
 */
async function testPersistence() {
  log('Beginning Persistence Tests');
  
  // Set values
  fontScalingManager.setFontScaling(1.3);
  highContrastManager.setHighContrast(true);
  
  // Simulate page reload by reinitializing components
  log('Simulating page reload...');
  await fontScalingManager.initialize();
  await highContrastManager.initialize();
  
  // Check if values persist
  assert(Math.abs(fontScalingManager.getCurrentScalingLevel() - 1.3) < 0.01, 
    'Font scaling should persist after reload');
  assert(highContrastManager.isHighContrastEnabled() === true, 
    'High contrast setting should persist after reload');
  
  // Reset values for other tests
  fontScalingManager.resetFontScaling();
  highContrastManager.setHighContrast(false);
  
  log('Persistence Tests Completed', 'success');
}

/**
 * Test ARIA announcements from accessibility features
 */
async function testAriaAnnouncements() {
  log('Beginning ARIA Announcement Tests');
  
  // Setup mock ARIA announcement listener
  const announcements = [];
  const originalAnnouncer = document.getElementById('alejo-screen-reader-announcer');
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.target.textContent) {
        announcements.push(mutation.target.textContent);
      }
    });
  });
  
  observer.observe(originalAnnouncer, { childList: true });
  
  // Trigger actions that should produce announcements
  fontScalingManager.setFontScaling(1.5);
  await delay(config.ariaAnnounceDelay);
  highContrastManager.setHighContrast(true);
  await delay(config.ariaAnnounceDelay);
  
  // Check announcements
  assert(announcements.length >= 2, 
    'Should have made at least 2 ARIA announcements');
  assert(announcements.some(a => a.toLowerCase().includes('font') || a.toLowerCase().includes('size')), 
    'Should announce font size change');
  assert(announcements.some(a => a.toLowerCase().includes('contrast') || a.toLowerCase().includes('high contrast')), 
    'Should announce high contrast change');
  
  // Cleanup
  observer.disconnect();
  
  log('ARIA Announcement Tests Completed', 'success');
}

/**
 * Test event emissions from accessibility features
 */
async function testEventEmissions() {
  log('Beginning Event Emission Tests');
  
  // Setup event listeners
  const events = [];
  const eventHandler = (eventName) => (data) => {
    events.push({ event: eventName, data });
  };
  
  // Register event listeners
  eventEmitter.on('accessibility:font-scaling:changed', eventHandler('font-scaling-changed'));
  eventEmitter.on('accessibility:high-contrast:changed', eventHandler('high-contrast-changed'));
  eventEmitter.on('layout:adjust-for-font-scaling', eventHandler('layout-adjust'));
  
  // Trigger events
  fontScalingManager.setFontScaling(1.7);
  highContrastManager.setHighContrast(true);
  
  // Check events
  await delay(100);
  
  assert(events.some(e => e.event === 'font-scaling-changed'), 
    'Should emit font scaling changed event');
  assert(events.some(e => e.event === 'high-contrast-changed'), 
    'Should emit high contrast changed event');
  assert(events.some(e => e.event === 'layout-adjust'), 
    'Should emit layout adjustment event');
  
  // Unregister event listeners
  eventEmitter.off('accessibility:font-scaling:changed', eventHandler('font-scaling-changed'));
  eventEmitter.off('accessibility:high-contrast:changed', eventHandler('high-contrast-changed'));
  eventEmitter.off('layout:adjust-for-font-scaling', eventHandler('layout-adjust'));
  
  log('Event Emission Tests Completed', 'success');
}

/**
 * Set up the ARIA announcer element if it doesn't exist
 */
function setupAriaAnnouncer() {
  let announcer = document.getElementById('alejo-screen-reader-announcer');
  
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'alejo-screen-reader-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.position = 'absolute';
    announcer.style.width = '1px';
    announcer.style.height = '1px';
    announcer.style.margin = '-1px';
    announcer.style.padding = '0';
    announcer.style.overflow = 'hidden';
    announcer.style.clip = 'rect(0, 0, 0, 0)';
    announcer.style.whiteSpace = 'nowrap';
    announcer.style.border = '0';
    
    document.body.appendChild(announcer);
  }
  
  return announcer;
}

/**
 * Helper function to log messages with formatting
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  let style = '';
  
  switch (type) {
    case 'success':
      style = 'color: green; font-weight: bold;';
      break;
    case 'error':
      style = 'color: red; font-weight: bold;';
      break;
    case 'warning':
      style = 'color: orange; font-weight: bold;';
      break;
    case 'info':
    default:
      style = 'color: blue;';
      break;
  }
  
  console.log(`%c[${timestamp}] ${message}`, style);
  
  // Store in test results
  testState.results.log.push({
    time: timestamp,
    message,
    type
  });
  
  // Update UI if test container exists
  const logContainer = document.getElementById('test-log');
  if (logContainer) {
    const logItem = document.createElement('div');
    logItem.className = `log-item ${type}`;
    logItem.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
    logContainer.appendChild(logItem);
    
    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

/**
 * Helper function for assertions
 */
function assert(condition, message) {
  testState.assertions++;
  testState.results.total++;
  
  if (condition) {
    testState.results.passed++;
    log(`✓ PASS: ${message}`, 'success');
    return true;
  } else {
    testState.results.failed++;
    log(`✗ FAIL: ${message}`, 'error');
    return false;
  }
}

/**
 * Helper function to create a delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Show test summary
 */
function showSummary() {
  const duration = Date.now() - testState.startTime;
  const passed = testState.results.passed;
  const failed = testState.results.failed;
  const total = testState.results.total;
  
  log('--------------------------------------------');
  log(`Test Summary: ${passed}/${total} tests passed (${failed} failed)`);
  log(`Total Assertions: ${testState.assertions}`);
  log(`Duration: ${duration}ms`);
  
  if (failed > 0) {
    log('Some tests failed!', 'error');
  } else {
    log('All tests passed!', 'success');
  }
  
  // Update UI if results container exists
  const resultsContainer = document.getElementById('test-results');
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="summary ${failed > 0 ? 'failed' : 'passed'}">
        <h3>Test Results</h3>
        <p>Status: ${failed > 0 ? 'FAILED' : 'PASSED'}</p>
        <p>Passed: ${passed}/${total} (${Math.round(passed/total*100)}%)</p>
        <p>Failed: ${failed}</p>
        <p>Duration: ${duration}ms</p>
      </div>
    `;
  }
  
  testState.running = false;
}

// Export test functions
export {
  runTests,
  testFontScaling,
  testHighContrast,
  testCombinedFeatures,
  testPersistence,
  testAriaAnnouncements
};
