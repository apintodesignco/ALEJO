/**
 * @file voice-monitoring-test.js
 * @description Test script for voice monitoring dashboard integration
 * @author ALEJO Development Team
 */

// Import necessary modules
import { EventBus } from '../src/core/event-bus.js';
import { getVoiceDashboardData } from '../src/personalization/voice/dashboard-integration.js';
import { getResourceThresholds } from '../src/core/system/resource-threshold-section.js';

/**
 * Run a simple test of voice monitoring dashboard integration
 */
async function testVoiceMonitoring() {
  console.log('Starting voice monitoring integration test...');
  const eventBus = EventBus.getInstance();
  
  // 1. Test threshold configuration
  console.log('\n--- Testing threshold configuration ---');
  const thresholds = getResourceThresholds();
  console.log('Current resource thresholds:', thresholds);
  
  // 2. Test voice dashboard data retrieval
  console.log('\n--- Testing voice dashboard data ---');
  try {
    const voiceData = getVoiceDashboardData();
    console.log('Voice dashboard data:', voiceData);
  } catch (error) {
    console.error('Error retrieving voice dashboard data:', error);
  }
  
  // 3. Test voice system status update event
  console.log('\n--- Testing voice system events ---');
  console.log('Sending test voice system status update...');
  
  const testStatus = {
    system: { status: 'active', lastUpdated: Date.now() },
    recognition: { status: 'active', lastUpdated: Date.now() },
    synthesis: { status: 'active', lastUpdated: Date.now() },
    training: { status: 'inactive', lastUpdated: Date.now() },
    resourceMode: 'normal'
  };
  
  eventBus.emit('voice:status-update', testStatus);
  console.log('Voice status update event emitted');
  
  // 4. Test performance metrics update
  console.log('\n--- Testing performance metrics ---');
  const testPerformance = {
    recognitionAttempts: 24,
    recognitionSuccesses: 21,
    recognitionErrors: 3,
    synthesisRequests: 45,
    synthesisCompletions: 45,
    averageRecognitionTime: 843.2,
    averageSynthesisTime: 267.8,
    trainingSessionsStarted: 2,
    trainingSessionsCompleted: 1
  };
  
  eventBus.emit('voice:performance-update', testPerformance);
  console.log('Voice performance update event emitted');
  
  // 5. Test resource usage update
  console.log('\n--- Testing resource usage ---');
  const testResourceUsage = {
    cpu: 45.7,
    memory: 32.4,
    temperature: 68.2,
    timestamp: Date.now()
  };
  
  eventBus.emit('voice:resource-usage', testResourceUsage);
  console.log('Voice resource usage event emitted');
  
  // 6. Test threshold crossing
  console.log('\n--- Testing threshold crossing event ---');
  const highResourceUsage = {
    cpu: 87.5, // This should trigger warning threshold
    memory: 45.3,
    temperature: 76.8,
    timestamp: Date.now()
  };
  
  eventBus.emit('voice:resource-usage', highResourceUsage);
  console.log('High resource usage event emitted (should trigger threshold warning)');
  
  // Wait a moment to allow events to process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 7. Test dashboard update event
  console.log('\n--- Testing dashboard update event ---');
  eventBus.emit('dashboard:update-request', { section: 'voice' });
  console.log('Dashboard update request event emitted');
  
  console.log('\nTest complete. Open the monitoring dashboard to view results.');
}

// Run the test
testVoiceMonitoring().catch(error => {
  console.error('Test failed:', error);
});
