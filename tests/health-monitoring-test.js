/**
 * @file health-monitoring-test.js
 * @description Test script for verifying the health monitoring system integration
 */

import componentHealthMonitor from '../src/core/system/component-health-monitor.js';
import { EventBus } from '../src/core/events/event-bus.js';
import { Logger } from '../src/core/utils/logger.js';
import { AuditTrail } from '../src/core/utils/audit-trail.js';

// Initialize logger and audit trail for testing
const logger = new Logger('HealthMonitoringTest', { level: 'debug' });
const auditTrail = new AuditTrail('health-monitoring-test');

// Test state
const testState = {
  healthEvents: [],
  componentUpdates: [],
  componentStatuses: {}
};

// Mock component status for testing
const mockComponentStatuses = {
  voiceSystem: {
    healthy: {
      status: 'healthy',
      details: {
        components: {
          recognition: 'healthy',
          synthesis: 'healthy'
        },
        uptime: 3600
      }
    },
    degraded: {
      status: 'degraded',
      details: {
        components: {
          recognition: 'healthy',
          synthesis: 'degraded'
        },
        warning: 'Voice synthesis performance is degraded',
        uptime: 3600
      }
    },
    error: {
      status: 'error',
      details: {
        components: {
          recognition: 'error',
          synthesis: 'healthy'
        },
        error: 'Voice recognition failed to initialize',
        uptime: 0
      }
    }
  },
  faceRecognition: {
    healthy: {
      status: 'healthy',
      details: {
        modelsLoaded: ['face-detection', 'face-landmarks'],
        memoryUsage: 'normal',
        hasRecentActivity: true
      }
    },
    degraded: {
      status: 'degraded',
      details: {
        modelsLoaded: ['face-detection'],
        warning: 'Face landmarks model failed to load',
        memoryUsage: 'high',
        hasRecentActivity: true
      }
    },
    error: {
      status: 'error',
      details: {
        error: 'Failed to access camera for face recognition',
        recommendation: 'Check camera permissions and connections'
      }
    }
  }
};

// Mock health check functions
const mockHealthChecks = {
  voiceSystem: async (mockStatus = 'healthy') => {
    logger.debug('Running mock voice system health check');
    return mockComponentStatuses.voiceSystem[mockStatus];
  },
  
  faceRecognition: async (mockStatus = 'healthy') => {
    logger.debug('Running mock face recognition health check');
    return mockComponentStatuses.faceRecognition[mockStatus];
  },
  
  memorySystem: async (mockStatus = 'healthy') => {
    logger.debug('Running mock memory system health check');
    return {
      status: mockStatus,
      details: {
        storageUsed: mockStatus === 'healthy' ? '45%' : '95%',
        indexIntegrity: mockStatus === 'error' ? 'corrupted' : 'intact',
        lastBackup: new Date().toISOString()
      }
    };
  },
  
  reasoningEngine: async (mockStatus = 'healthy') => {
    logger.debug('Running mock reasoning engine health check');
    return {
      status: mockStatus,
      details: {
        logicalConsistency: mockStatus === 'healthy' ? 'valid' : 'issues detected',
        factsDbStatus: mockStatus === 'error' ? 'inaccessible' : 'accessible',
        performanceMetrics: {
          inferenceTime: mockStatus === 'degraded' ? '500ms' : '50ms'
        }
      }
    };
  }
};

// Event listeners for test validation
function setupTestEventListeners() {
  logger.info('Setting up test event listeners');
  
  // Listen for system health events
  EventBus.subscribe('monitoring:systemHealth', (data) => {
    logger.debug('Received system health event:', data);
    testState.healthEvents.push({
      type: 'systemHealth',
      timestamp: Date.now(),
      data
    });
    
    // Log the overall system status
    logger.info(`System health status: ${data.status}`);
  });
  
  // Listen for component status updates
  EventBus.subscribe('monitoring:componentStatus', (data) => {
    logger.debug(`Received component status update for ${data.component}:`, data);
    testState.componentUpdates.push({
      type: 'componentStatus',
      timestamp: Date.now(),
      data
    });
    
    // Store the current status of each component
    testState.componentStatuses[data.component] = data.status;
    
    // Log the component status
    logger.info(`Component ${data.component} status: ${data.status}`);
  });
}

// Clean up test event listeners
function cleanupTestEventListeners() {
  logger.info('Cleaning up test event listeners');
  EventBus.unsubscribe('monitoring:systemHealth');
  EventBus.unsubscribe('monitoring:componentStatus');
}

// Test health monitoring initialization
async function testHealthMonitorInitialization() {
  logger.info('=== Testing Health Monitor Initialization ===');
  
  try {
    const initResult = await componentHealthMonitor.initialize({
      autoCheckInterval: 30000, // 30 seconds for testing
      checkTimeout: 5000,       // 5 seconds timeout
      criticalComponents: ['voiceSystem', 'faceRecognition']
    });
    
    if (initResult) {
      logger.info('✅ Health monitor initialized successfully');
      auditTrail.log('info', 'Health monitor initialized for testing');
      return true;
    } else {
      logger.error('❌ Health monitor initialization failed');
      auditTrail.log('error', 'Health monitor initialization failed');
      return false;
    }
  } catch (error) {
    logger.error('❌ Error initializing health monitor:', error);
    auditTrail.log('error', 'Error initializing health monitor', { error: error.message });
    return false;
  }
}

// Test component health checker registration
async function testComponentCheckerRegistration() {
  logger.info('=== Testing Component Health Checker Registration ===');
  
  try {
    // Register mock health checks for various components
    componentHealthMonitor.registerComponentChecker(
      'voiceSystem',
      () => mockHealthChecks.voiceSystem('healthy'),
      true // Critical component
    );
    logger.info('✅ Registered voice system health checker');
    
    componentHealthMonitor.registerComponentChecker(
      'faceRecognition',
      () => mockHealthChecks.faceRecognition('healthy'),
      true // Critical component
    );
    logger.info('✅ Registered face recognition health checker');
    
    componentHealthMonitor.registerComponentChecker(
      'memorySystem',
      () => mockHealthChecks.memorySystem('healthy'),
      true // Critical component
    );
    logger.info('✅ Registered memory system health checker');
    
    componentHealthMonitor.registerComponentChecker(
      'reasoningEngine',
      () => mockHealthChecks.reasoningEngine('healthy'),
      true // Critical component
    );
    logger.info('✅ Registered reasoning engine health checker');
    
    componentHealthMonitor.registerComponentChecker(
      'testComponent',
      async () => ({
        status: 'healthy',
        details: { testProp: 'test value' }
      }),
      false // Non-critical component
    );
    logger.info('✅ Registered test component health checker');
    
    return true;
  } catch (error) {
    logger.error('❌ Error registering component health checkers:', error);
    auditTrail.log('error', 'Error registering component health checkers', { error: error.message });
    return false;
  }
}

// Test manual health check
async function testManualHealthCheck() {
  logger.info('=== Testing Manual Health Check ===');
  
  try {
    // Clear previous events
    testState.healthEvents = [];
    testState.componentUpdates = [];
    
    // Trigger a manual health check
    const healthStatus = await componentHealthMonitor.performSystemHealthCheck();
    
    logger.info('Health check completed with status:', healthStatus.status);
    logger.debug('Health status details:', healthStatus);
    
    // Check if events were published
    if (testState.healthEvents.length > 0) {
      logger.info(`✅ ${testState.healthEvents.length} system health events received`);
    } else {
      logger.warn('⚠️ No system health events received');
    }
    
    if (testState.componentUpdates.length > 0) {
      logger.info(`✅ ${testState.componentUpdates.length} component status updates received`);
    } else {
      logger.warn('⚠️ No component status updates received');
    }
    
    return healthStatus;
  } catch (error) {
    logger.error('❌ Error performing manual health check:', error);
    auditTrail.log('error', 'Error performing manual health check', { error: error.message });
    return null;
  }
}

// Test degraded component handling
async function testDegradedComponentHandling() {
  logger.info('=== Testing Degraded Component Handling ===');
  
  try {
    // Update voice system to degraded state
    componentHealthMonitor.registerComponentChecker(
      'voiceSystem',
      () => mockHealthChecks.voiceSystem('degraded'),
      true // Critical component
    );
    logger.info('Updated voice system health checker to return degraded status');
    
    // Clear previous events
    testState.healthEvents = [];
    testState.componentUpdates = [];
    
    // Trigger a manual health check
    const healthStatus = await componentHealthMonitor.performSystemHealthCheck();
    
    logger.info('Health check completed with status:', healthStatus.status);
    
    // Verify system status reflects the degraded component
    if (healthStatus.status === 'degraded') {
      logger.info('✅ System status correctly set to degraded');
    } else {
      logger.warn(`⚠️ System status not reflecting degraded component: ${healthStatus.status}`);
    }
    
    return healthStatus;
  } catch (error) {
    logger.error('❌ Error testing degraded component handling:', error);
    auditTrail.log('error', 'Error testing degraded component handling', { error: error.message });
    return null;
  }
}

// Test error component handling
async function testErrorComponentHandling() {
  logger.info('=== Testing Error Component Handling ===');
  
  try {
    // Update face recognition to error state
    componentHealthMonitor.registerComponentChecker(
      'faceRecognition',
      () => mockHealthChecks.faceRecognition('error'),
      true // Critical component
    );
    logger.info('Updated face recognition health checker to return error status');
    
    // Clear previous events
    testState.healthEvents = [];
    testState.componentUpdates = [];
    
    // Trigger a manual health check
    const healthStatus = await componentHealthMonitor.performSystemHealthCheck();
    
    logger.info('Health check completed with status:', healthStatus.status);
    
    // Verify system status reflects the error component
    if (healthStatus.status === 'error' || healthStatus.status === 'degraded') {
      logger.info(`✅ System status correctly set to ${healthStatus.status}`);
    } else {
      logger.warn(`⚠️ System status not reflecting error component: ${healthStatus.status}`);
    }
    
    return healthStatus;
  } catch (error) {
    logger.error('❌ Error testing error component handling:', error);
    auditTrail.log('error', 'Error testing error component handling', { error: error.message });
    return null;
  }
}

// Test health check function
async function testHealthCheckFunction() {
  logger.info('=== Testing Individual Health Check Function ===');
  
  try {
    // Test checking a specific component
    const componentStatus = await componentHealthMonitor.checkComponentHealth('reasoningEngine');
    
    if (componentStatus) {
      logger.info('✅ Successfully checked individual component health');
      logger.debug('Component status:', componentStatus);
      return componentStatus;
    } else {
      logger.warn('⚠️ Failed to check individual component health');
      return null;
    }
  } catch (error) {
    logger.error('❌ Error checking individual component health:', error);
    auditTrail.log('error', 'Error checking individual component health', { error: error.message });
    return null;
  }
}

// Test cleanup
async function testCleanup() {
  logger.info('=== Testing Health Monitor Cleanup ===');
  
  try {
    componentHealthMonitor.cleanup();
    logger.info('✅ Health monitor cleanup completed');
    return true;
  } catch (error) {
    logger.error('❌ Error during health monitor cleanup:', error);
    auditTrail.log('error', 'Error during health monitor cleanup', { error: error.message });
    return false;
  }
}

// Run all tests
async function runAllTests(options = {}) {
  logger.info('======= STARTING HEALTH MONITORING TESTS =======');
  auditTrail.log('info', 'Starting health monitoring system tests');
  
  // Test results tracking
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    failures: [],
    metrics: {}
  };
  
  // Helper function to run a test and track results
  async function runTest(name, testFn, isCritical = false) {
    results.total++;
    logger.info(`\nRunning test: ${name}`);
    
    try {
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      // Check if test returned a result object or just a boolean
      const success = typeof result === 'object' ? result.success !== false : !!result;
      
      if (success) {
        results.passed++;
        logger.info(`✅ Test '${name}' passed (${duration}ms)`);
        
        // Store metrics if available
        if (result && result.metrics) {
          results.metrics[name] = result.metrics;
        }
      } else {
        results.failed++;
        const errorMessage = typeof result === 'object' && result.message ? result.message : 'Test failed';
        logger.error(`❌ Test '${name}' failed: ${errorMessage}`);
        
        results.failures.push({
          name,
          error: errorMessage,
          details: result
        });
        
        // If this is a critical test and it failed, abort remaining tests
        if (isCritical) {
          logger.error(`Critical test '${name}' failed, aborting remaining tests`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      results.failed++;
      logger.error(`❌ Test '${name}' threw an exception:`, error);
      
      results.failures.push({
        name,
        error: error.message || String(error),
        exception: error
      });
      
      // If this is a critical test and it failed, abort remaining tests
      if (isCritical) {
        logger.error(`Critical test '${name}' failed with exception, aborting remaining tests`);
        return false;
      }
      
      return false;
    }
  }
  
  // Set up event listeners
  setupTestEventListeners();
  
  try {
    // Run initialization tests (critical)
    if (!await runTest('Health Monitor Initialization', testHealthMonitorInitialization, true)) {
      return results;
    }
    
    if (!await runTest('Component Checker Registration', testComponentCheckerRegistration, true)) {
      await testCleanup();
      return results;
    }
    
    // Run health check tests
    await runTest('Manual Health Check', testManualHealthCheck);
    await runTest('Degraded Component Handling', testDegradedComponentHandling);
    await runTest('Error Component Handling', testErrorComponentHandling);
    await runTest('Individual Health Check Function', testHealthCheckFunction);
    
    // Run performance tests if not in quick mode
    if (!options.quick) {
      await runTest('Performance Benchmarks', testPerformanceBenchmarks);
    }
  } finally {
    // Always clean up, even if tests fail
    try {
      await testCleanup();
      cleanupTestEventListeners();
    } catch (error) {
      logger.error('Error during test cleanup:', error);
    }
  }
  
  // Log summary
  logger.info('\n======= HEALTH MONITORING TESTS SUMMARY =======');
  logger.info(`Tests run: ${results.total}`);
  logger.info(`Passed: ${results.passed}`);
  logger.info(`Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    logger.info('\nFailed tests:');
    results.failures.forEach((failure, index) => {
      logger.info(`${index + 1}. ${failure.name}: ${failure.error}`);
    });
  }
  
  logger.info('\n======= HEALTH MONITORING TESTS COMPLETED =======');
  auditTrail.log('info', 'Health monitoring system tests completed', { 
    summary: `${results.passed}/${results.total} tests passed` 
  });
  
  return results;
}

// Execute tests when run directly
if (typeof process !== 'undefined' && process.argv[1] === import.meta.url) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    quick: args.includes('--quick') || args.includes('-q')
  };
  
  runAllTests(options)
    .then(results => {
      // Summary is already logged by runAllTests
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Error running health monitoring tests:', error);
      process.exit(1);
    });
}

// Performance benchmarks test
async function testPerformanceBenchmarks() {
  logger.info('=== Testing Performance Benchmarks ===');
  
  try {
    // Re-initialize with healthy components
    await testHealthMonitorInitialization();
    await testComponentCheckerRegistration();
    
    // CPU and memory usage before tests
    const startUsage = process.cpuUsage();
    const startMemory = process.memoryUsage();
    
    // Run multiple health checks in succession
    const iterations = 10;
    const startTime = Date.now();
    
    logger.info(`Running ${iterations} consecutive health checks...`);
    
    for (let i = 0; i < iterations; i++) {
      await componentHealthMonitor.performSystemHealthCheck();
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const avgDuration = duration / iterations;
    
    // CPU and memory usage after tests
    const endUsage = process.cpuUsage(startUsage);
    const endMemory = process.memoryUsage();
    
    // Calculate CPU usage in percentage
    const cpuUsageMs = endUsage.user + endUsage.system;
    const cpuUsagePercent = (cpuUsageMs / duration) * 100;
    
    // Calculate memory increase
    const heapIncrease = endMemory.heapUsed - startMemory.heapUsed;
    const heapIncreasePercent = (heapIncrease / startMemory.heapUsed) * 100;
    
    logger.info(`Performance results:`);
    logger.info(`- Average health check duration: ${avgDuration.toFixed(2)}ms`);
    logger.info(`- CPU usage: ${cpuUsagePercent.toFixed(2)}% during tests`);
    logger.info(`- Memory heap increase: ${(heapIncrease / 1024 / 1024).toFixed(2)}MB (${heapIncreasePercent.toFixed(2)}%)`);
    
    // Check if performance meets requirements
    const performanceIssues = [];
    
    if (avgDuration > 500) {
      performanceIssues.push(`Health check duration (${avgDuration.toFixed(2)}ms) exceeds 500ms target`);
    }
    
    if (cpuUsagePercent > 25) {
      performanceIssues.push(`CPU usage (${cpuUsagePercent.toFixed(2)}%) exceeds 25% target`);
    }
    
    if (heapIncreasePercent > 20) {
      performanceIssues.push(`Memory growth (${heapIncreasePercent.toFixed(2)}%) exceeds 20% target`);
    }
    
    if (performanceIssues.length > 0) {
      logger.warn('Performance issues detected:', performanceIssues);
      return {
        success: false,
        message: `Performance issues: ${performanceIssues.join('; ')}`,
        metrics: {
          avgDuration,
          cpuUsagePercent,
          heapIncreasePercent
        }
      };
    }
    
    return {
      success: true,
      metrics: {
        avgDuration,
        cpuUsagePercent,
        heapIncreasePercent
      }
    };
  } catch (error) {
    logger.error('Error during performance benchmarks:', error);
    return {
      success: false,
      message: `Error during performance benchmarks: ${error.message}`,
      error
    };
  } finally {
    // Clean up after performance tests
    await testCleanup();
  }
}

// Export public API
export {
  runAllTests,
  testHealthMonitorInitialization,
  testComponentCheckerRegistration,
  testManualHealthCheck,
  testDegradedComponentHandling,
  testErrorComponentHandling,
  testHealthCheckFunction,
  testPerformanceBenchmarks,
  mockHealthChecks
};
