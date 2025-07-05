/**
 * ALEJO Vision-Voice Fusion Performance Test
 * 
 * This script tests the performance characteristics of the vision-voice fusion module
 * under various load conditions, measuring processing time, memory usage, and CPU utilization.
 */

import { visionVoiceFusion } from '../../src/integration/fusion/vision-voice-fusion.js';
import { eventBus } from '../../src/core/event-bus.js';
import { performance } from 'perf_hooks';

// Configuration
const TEST_DURATION_MS = 30000; // 30 seconds
const EVENT_FREQUENCIES = {
  LOW: 1000,    // 1 event per second
  MEDIUM: 200,  // 5 events per second
  HIGH: 50      // 20 events per second
};
const SAMPLE_INTERVAL_MS = 500; // Performance sampling interval

// Mock consent manager to always return true
globalThis.consentManager = {
  hasConsent: async () => true,
  requestConsent: async () => true
};

// Mock audit trail
globalThis.auditTrail = {
  log: () => {}
};

// Performance metrics
const metrics = {
  processingTimes: [],
  memoryUsage: [],
  eventCounts: {
    received: 0,
    processed: 0,
    fused: 0
  },
  startTime: 0,
  endTime: 0
};

/**
 * Generate random emotion data
 */
function generateRandomEmotionData() {
  const emotions = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
  const dominant = emotions[Math.floor(Math.random() * emotions.length)];
  
  const emotionValues = {};
  let total = 0;
  
  // Generate random values for each emotion
  emotions.forEach(emotion => {
    emotionValues[emotion] = Math.random();
    total += emotionValues[emotion];
  });
  
  // Normalize values
  emotions.forEach(emotion => {
    emotionValues[emotion] /= total;
  });
  
  // Ensure dominant emotion has highest value
  const maxValue = Math.max(...Object.values(emotionValues));
  emotionValues[dominant] = maxValue * 1.2;
  
  return {
    dominant,
    confidence: 0.7 + Math.random() * 0.3, // Random confidence between 0.7 and 1.0
    emotions: emotionValues
  };
}

/**
 * Generate random verification data
 */
function generateRandomVerificationData() {
  const userId = `user-${Math.floor(Math.random() * 5)}`; // 5 possible users
  
  return {
    userId,
    isVerified: Math.random() > 0.2, // 80% chance of verification success
    confidence: 0.6 + Math.random() * 0.4 // Random confidence between 0.6 and 1.0
  };
}

/**
 * Generate random command data
 */
function generateRandomCommandData() {
  const commands = [
    'open menu',
    'close window',
    'play music',
    'stop playback',
    'increase volume',
    'decrease brightness',
    'show notifications',
    'hide sidebar'
  ];
  
  const command = commands[Math.floor(Math.random() * commands.length)];
  
  return {
    command,
    parameters: {},
    confidence: 0.7 + Math.random() * 0.3 // Random confidence between 0.7 and 1.0
  };
}

/**
 * Simulate vision and voice events at specified frequency
 */
function simulateEvents(frequency) {
  // Voice emotion events
  setInterval(() => {
    const data = generateRandomEmotionData();
    const startTime = performance.now();
    
    eventBus.emit('voice_emotion_detected', data);
    metrics.eventCounts.received++;
    
    // Track processing time
    eventBus.once('fused_emotional_state', () => {
      const processingTime = performance.now() - startTime;
      metrics.processingTimes.push(processingTime);
      metrics.eventCounts.fused++;
    });
  }, frequency);
  
  // Facial expression events
  setInterval(() => {
    const data = generateRandomEmotionData();
    eventBus.emit('facial_expression_detected', data);
    metrics.eventCounts.received++;
  }, frequency * 1.2); // Slightly different frequency to create realistic offset
  
  // Voice verification events
  setInterval(() => {
    const data = generateRandomVerificationData();
    eventBus.emit('voice_verification_result', data);
    metrics.eventCounts.received++;
  }, frequency * 5); // Less frequent
  
  // Face verification events
  setInterval(() => {
    const data = generateRandomVerificationData();
    eventBus.emit('face_verification_result', data);
    metrics.eventCounts.received++;
  }, frequency * 5); // Less frequent
  
  // Voice command events
  setInterval(() => {
    const data = generateRandomCommandData();
    eventBus.emit('voice_command_detected', data);
    metrics.eventCounts.received++;
  }, frequency * 3); // Less frequent than emotions
}

/**
 * Sample performance metrics
 */
function samplePerformance() {
  const memUsage = process.memoryUsage();
  
  metrics.memoryUsage.push({
    timestamp: Date.now() - metrics.startTime,
    heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
    heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
    rss: memUsage.rss / 1024 / 1024 // MB
  });
}

/**
 * Calculate statistics for an array of numbers
 */
function calculateStats(array) {
  if (array.length === 0) return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
  
  const sorted = [...array].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

/**
 * Print test results
 */
function printResults() {
  const duration = (metrics.endTime - metrics.startTime) / 1000; // seconds
  const processingStats = calculateStats(metrics.processingTimes);
  
  console.log('\n========== VISION-VOICE FUSION PERFORMANCE TEST RESULTS ==========');
  console.log(`\nTest Duration: ${duration.toFixed(2)} seconds`);
  
  console.log('\nEvent Counts:');
  console.log(`  Events Received: ${metrics.eventCounts.received}`);
  console.log(`  Events Processed: ${metrics.eventCounts.processed}`);
  console.log(`  Events Fused: ${metrics.eventCounts.fused}`);
  console.log(`  Events/Second: ${(metrics.eventCounts.received / duration).toFixed(2)}`);
  
  console.log('\nProcessing Time (ms):');
  console.log(`  Minimum: ${processingStats.min.toFixed(2)}`);
  console.log(`  Maximum: ${processingStats.max.toFixed(2)}`);
  console.log(`  Average: ${processingStats.avg.toFixed(2)}`);
  console.log(`  95th Percentile: ${processingStats.p95.toFixed(2)}`);
  console.log(`  99th Percentile: ${processingStats.p99.toFixed(2)}`);
  
  // Calculate memory growth
  if (metrics.memoryUsage.length >= 2) {
    const firstSample = metrics.memoryUsage[0];
    const lastSample = metrics.memoryUsage[metrics.memoryUsage.length - 1];
    
    console.log('\nMemory Usage (MB):');
    console.log(`  Initial Heap: ${firstSample.heapUsed.toFixed(2)}`);
    console.log(`  Final Heap: ${lastSample.heapUsed.toFixed(2)}`);
    console.log(`  Growth: ${(lastSample.heapUsed - firstSample.heapUsed).toFixed(2)}`);
    console.log(`  Growth Rate: ${((lastSample.heapUsed - firstSample.heapUsed) / duration).toFixed(2)} MB/s`);
  }
  
  console.log('\n================================================================\n');
}

/**
 * Run performance test with specified event frequency
 */
async function runPerformanceTest(frequency) {
  console.log(`\nStarting performance test with ${1000/frequency} events/second frequency...`);
  
  // Reset metrics
  metrics.processingTimes = [];
  metrics.memoryUsage = [];
  metrics.eventCounts = { received: 0, processed: 0, fused: 0 };
  
  // Initialize fusion module with default config
  await visionVoiceFusion.initialize();
  
  // Track processed events
  const originalAttemptFusion = visionVoiceFusion._attemptFusion;
  visionVoiceFusion._attemptFusion = function() {
    metrics.eventCounts.processed++;
    return originalAttemptFusion.apply(this, arguments);
  };
  
  // Start performance sampling
  const samplingInterval = setInterval(samplePerformance, SAMPLE_INTERVAL_MS);
  
  // Start test
  metrics.startTime = Date.now();
  simulateEvents(frequency);
  
  // Run for specified duration
  await new Promise(resolve => setTimeout(resolve, TEST_DURATION_MS));
  
  // End test
  metrics.endTime = Date.now();
  clearInterval(samplingInterval);
  
  // Shutdown fusion module
  await visionVoiceFusion.shutdown();
  
  // Print results
  printResults();
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('ALEJO Vision-Voice Fusion Performance Test');
    console.log('=========================================');
    
    // Run tests with different event frequencies
    await runPerformanceTest(EVENT_FREQUENCIES.LOW);
    await runPerformanceTest(EVENT_FREQUENCIES.MEDIUM);
    await runPerformanceTest(EVENT_FREQUENCIES.HIGH);
    
    console.log('Performance testing completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Performance test failed:', error);
    process.exit(1);
  }
}

// Run the test
main();
